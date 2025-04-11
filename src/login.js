import fetch from 'node-fetch'
import { printCheck } from '../lib/utils.js'
import * as cheerio from 'cheerio'


/**
 * Login into WordPress using user credential and returns session cookies
 *
 * @async
 * @param {string} host
 * @param {string} user
 * @param {string} password
 * @returns {Promise<string>} - Session cookies
 */
async function login(host, user, password) {
    const body = `log=${ user }&pwd=${password}&wp-submit=Log+in&redirect_to=http%3A%2F%2F${ host }%2Fwp-admin%2F&testcookie=1`
    let cookie = 'wordpress_test_cookie=WP%20Cookie%20check;'
    const response = await fetch(host + '/wp-login.php', {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie
        },
        redirect: 'manual'
    })

    // WP returns 302 redirect if login succeeded and 200 if it did not
    if (response.status !== 302) {
        console.error(`${ printCheck.failure() } Login attempt with user ${ user } failed`)
        const html = await response.text()
        const $ = cheerio.load(html)
        const error = $('#login_error > p:nth-child(1)').text()

        throw new Error(`WordPress message: "${ error }"`)
    }

    return response.headers.raw()['set-cookie'].map(cookie => cookie.split(';')[0]).join(';')
}


export { login }
