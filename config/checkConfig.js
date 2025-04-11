import fs from 'fs'
import * as utils from '../lib/utils.js'
import { appConfig } from './appConfig.js'


/**
 * This function check some elements of the configuration from appConfig.js which are necessary to run
 * @return {void}
 */
export function checkConfig() {
    const rootPath = appConfig.app.rootPath
    let errorMessages = []

    // app section
    if (!fs.existsSync(rootPath + appConfig.app.pluginFilePath)) {
        errorMessages.push(utils.textColoring('pluginFilePath', 'yellow') +
            " - Could not find or access file to generate plugin: " +
            utils.textColoring(rootPath + appConfig.app.pluginFilePath, 'yellow')
        )
    }
    // host section
    if (!utils.isUrlValid(appConfig.host.url)) {
        errorMessages.push(utils.textColoring('url', 'yellow') + " - URL is invalid: " +
            utils.textColoring(appConfig.host.url, 'yellow'))
    }
    // bruteforce section
    if (!fs.existsSync(rootPath + appConfig.bruteforce.wordlist)) {
        errorMessages.push(utils.textColoring('wordlist', 'yellow') +
            " - Could not find or access wordlist: "
            + utils.textColoring(rootPath + appConfig.bruteforce.wordlist, 'yellow')
        )
    }
    if (typeof(appConfig.bruteforce.concurrencyLimit) !== "number") {
        errorMessages.push(`"${ utils.textColoring('concurrencyLimit', 'yellow')}" - Should be an integer`)
    }
    if (typeof(appConfig.bruteforce.userAgent) !== "string") {
        errorMessages.push(`"${ utils.textColoring('userAgent', 'yellow')}" - Should be a string`)
    }
    // debug section
    if (typeof(appConfig.debug) !== "boolean") {
        errorMessages.push(`"${ utils.textColoring('debug', 'yellow')}" - Should be a boolean`)
    }


    if (errorMessages.length) {
        console.error(
            utils.printCheck.failure() +
            " Could not properly load configuration, please check the \"appConfig.js\" file:\n\t" +
            errorMessages.toString().replaceAll(',', '\n\t')
        )
        utils.exit(0)
    }
}
