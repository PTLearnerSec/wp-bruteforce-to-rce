import fetch from 'node-fetch'
import asyncFs, { unlink } from 'node:fs/promises'
import fs from 'fs'
import readline from 'readline'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import net from 'node:net'
import { appConfig } from '../config/appConfig.js'


/**
 * Display banner
 */
function displayBanner() {
    console.log(`
     __      _____   ___          _        __                  _         ___  ___ ___ 
     \\ \\    / / _ \\ | _ )_ _ _  _| |_ ___ / _|___ _ _ __ ___  | |_ ___  | _ \\/ __| __|
      \\ \\/\\/ /|  _/ | _ \\ '_| || |  _/ -_)  _/ _ \\ '_/ _/ -_) |  _/ _ \\ |   / (__| _| 
       \\_/\\_/ |_|   |___/_|  \\_,_|\\__\\___|_| \\___/_| \\__\\___|  \\__\\___/ |_|_\\\\___|___|
    `)
}

/**
 * Print a succeeded or failed check
 *
 * @type {{ success(): string; failure(): string; }}
 * @return {string}
 */
const printCheck = {
    success() {
        return `\t[${ textColoring('X', 'green') }]`
    },

    failure() {
        return `\t[${ textColoring('X', 'red') }]`
    }
}

/**
 * Check if debug mode is activated before logging error messages
 *
 * @type {{ error(message: any): void; }}
 */
const logging = {
    error(message) {
        if (appConfig.debug) {
            console.error(message)
        }
    },
}

/**
 * Return an array with uniq values
 *
 * @param {array} array
 * @returns {array}
 */
function uniq(array) {
    return [...new Set(array)]
}


/**
 * Check if a value is not null or undefined
 *
 * @param {*} value
 * @returns {boolean}
 */
function isDefined(value) {
    return value !== undefined && value !== null
}


/**
 * Check if an object is empty
 *
 * @param {object} obj
 * @returns {boolean}
 */
function isEmptyObject(obj) {
    if (!isDefined(obj) || typeof obj !== "object") {
        logging.error(`isEmptyObject parameter has to be a defined non-null object, received :\
            ${ typeof obj } -> ${ obj }`
        )
        throw new TypeError(`Expected object, got ${ typeof obj } instead.`)
    }
    for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false
        }
    }
    return true
}

/**
 * Check if a url is reachable
 *
 * @async
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function isReachable(url) {
    try {
        const res = await fetch(url, { headers: defaultHeaders(), agent: proxyAgent })
        return res.ok
    } catch (error) {
        logging.error(error)
        return false
    }
}

/**
 * Check if a url is valid
 *
 * @param {string} url
 * @returns {boolean}
 */
function isUrlValid(url) {
    return URL.canParse(url)
}

/**
 * Check if a url is valid
 *
 * @param {string} proxyUrl
 * @returns {boolean}
 */
function isProxyUrlValid(proxyUrl) {
    if (!URL.canParse(proxyUrl)) {
        return false
    }

    const { protocol, port } = new URL(proxyUrl)
    if ((protocol !== 'http:' && protocol !== 'https:') || !port) {
        return false
    }

    const portNum = Number(port)

    return portNum >= 1 && portNum <= 65535
}

/**
 * Replaces characters in a string based on a provided mapping object.
 *
 * This function iterates over an object where the keys represent characters to be replaced in the input string,
 * and the values represent the replacement characters
 *
 * @param {string} data - The string in which characters will be replaced
 * @param {Object.<string, string>} charsToReplace - Object where keys are characters to replace and values are their replacements
 * @returns {string} The modified string with the replacements
 */
function strReplace(data, charsToReplace) {
    for (const [key] of Object.entries(charsToReplace)) {
        data = data.replace(new RegExp([key].toString(), "g"), (match) => {
            return charsToReplace[match]
        })
    }

    return data
}

/**
 * Use a specific color in terminal
 *
 * @param {string} text - Text to print
 * @param {string} color - Available colors (red, green, yellow, blue)
 * @returns {string}
 */
function textColoring(text, color) {
    const controlSequenceIntroducer = '\x1b['
    const resetAttr = '\x1b[0m'
    const colorCode = { red: '31m', green: '32m', yellow: '33m', blue: '34m', white: '37m' }

    if (!isDefined(colorCode[color])) {
        logging.error(`Color ${ color } is not available, defaulting to white`)
        color = 'white'
    }

    return `${ controlSequenceIntroducer + colorCode[color] + text + resetAttr }`
}

/**
 * Generate pseudo random string using only letters and numbers
 *
 * @param {number} [stringLength=10] - The length of the string to generate (default is 10)
 * @returns {string}
 */
function randomString(stringLength = 10) {
    if (typeof (stringLength) !== "number") {
        throw new Error(`randomUrl() parameter should be int type, instead got ${ typeof stringLength }`)
    }

    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (let i = 0; i < stringLength; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    return result
}

/**
 * Async function to read file
 *
 * @async
 * @param {string} filePath - Path to the file to read from
 * @returns {Promise<string>}
 */
async function readFile(filePath) {
    try {
        return await asyncFs.readFile(filePath, { encoding: 'utf8' })
    } catch (error) {
        console.error(`Could not read file: ${ filePath }`)
        logging.error(error)
        exit(1)
    }
}

/**
 * Async function to remove a file
 *
 * @async
 * @param {string} path - Path to file to remove
 * @returns {Promise<void>}
 */
async function removeFile(path) {
    if (fs.existsSync(path)) {
        await unlink(path)
    }
}

/**
 * Split an array into smaller arrays
 *
 * @param {array} array - The initial array to split
 * @param {number} chunkSize - The size of each chunk
 * @returns {array<array, string>}
 */
function chunkArray(array, chunkSize) {
    if (typeof (array) !== "object" || !array.length) {
        throw new Error(`Could not split array into chunks. Error: \
            ${ typeof array !== "object" ? 'not an array' : 'array is empty'
        }`)
    }

    return array.reduce((accumulator, _, i) => {
        if (i % chunkSize === 0) {
            accumulator.push(array.slice(i, i + chunkSize))
        }

        return accumulator
    }, [])
}

/**
 * Split a wordlist into smaller chunks if necessary
 *
 * @async
 * @param {string} pathToWordlist - Path to the wordlist
 * @returns {array<array, string>}
 */
async function wordlistSplitting(pathToWordlist) {
    const passwords = []
    const chunkSize = 200
    const fileStream = fs.createReadStream(pathToWordlist)

    fileStream.on('error', (err) => {
        throw new Error(err.message)
    })

    const wordlist = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    for await (const password of wordlist) {
        passwords.push(password)
    }

    const splitList = {
        chunks: [],
        totalSize: passwords.length
    }

    if (passwords.length > chunkSize) {
        splitList.chunks = chunkArray(passwords, chunkSize)
    } else {
        splitList.chunks = [passwords]
    }

    return splitList
}

/**
 * Exit program
 *
 * @param {number} [errorCode=0] - The code error to use when exiting
 * @param {string} [message=''] - An optional message to print
 */
function exit(errorCode = 0, message = '') {
    console.log(`${ message }\n\nEnd of program`)
    process.exit(errorCode)
}


/**
 * Check if a proxy is reachable by attempting a TCP connection
 *
 * @async
 * @param {string} proxyUrl - The proxy URL to check
 * @param {number} [timeout=5000] - Connection timeout in milliseconds
 * @returns {Promise}
 */
function isProxyReachable(proxyUrl, timeout = 5000) {
    const { hostname, port } = new URL(proxyUrl)

    return new Promise((resolve) => {
        const socket = net.createConnection({ host: hostname, port }, () => {
            socket.destroy()
            resolve(true)
        })
        socket.setTimeout(timeout)
        socket.on('timeout', () => {
            socket.destroy()
            resolve(false)
        })
        socket.on('error', (error) => {
            console.error(`${ printCheck.failure() } Could not reach proxy: ${ textColoring(proxyUrl, 'yellow') }`)
            logging.error(error)
            resolve(false)
        })
    })
}

/**
 * Proxy agent for node-fetch. When proxy.url is configured, returns a function
 * that provides the appropriate agent based on the target URL protocol.
 * When no proxy is configured, returns undefined (node-fetch default behavior).
 *
 */
function proxyAgent() {
    if (appConfig?.proxy?.url && URL.canParse(appConfig.proxy.url)) {
        const urlProxy = appConfig.proxy.url

        if (!!urlProxy && URL.canParse(urlProxy)) {
            return new URL(urlProxy).protocol === 'http:' ? new HttpProxyAgent(urlProxy) : new HttpsProxyAgent(urlProxy)
        }

    }

    return undefined
}


/**
 * Default headers included in every HTTP request
 *
 * @returns {Object.<string, string>}
 */
function defaultHeaders() {
    return { 'User-Agent': appConfig.bruteforce.userAgent }
}

export {
    displayBanner,
    printCheck,
    logging,
    isProxyReachable,
    proxyAgent,
    defaultHeaders,
    uniq,
    isEmptyObject,
    isDefined,
    isReachable,
    isUrlValid,
    isProxyUrlValid,
    strReplace,
    randomString,
    readFile,
    removeFile,
    chunkArray,
    wordlistSplitting,
    textColoring,
    exit
}
