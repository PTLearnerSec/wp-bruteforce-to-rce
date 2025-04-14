import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import * as utils from '../lib/utils.js'


/**
 * Enumerate users using the sitemap
 *
 * @async
 * @param {string} host
 * @returns {Promise<array<string>>}
 */
async function enumUsersSitemap(host) {
    const endpoints = ['/author.xml', '/sitemap-author.xml']
    let users = []

    for (let endpoint of endpoints) {
        try {
            const url = host + endpoint
            const res = await fetch(url)

            if (res.status === 200 && res.headers.get('content-type') === 'application/xml') {
                const html = await res.text()
                const authorsLink = html.match(/author\/([^\/]+)/g)

                if (authorsLink.length) {
                    for (let link of authorsLink) {
                        users.push(link.split('/')[1])
                    }
                }
            }
        } catch (error) {
            utils.logging.error(error)
        }
    }

    return users
}

/**
 * Enumerate users using REST API
 *
 * @async
 * @param {string} host
 * @returns {Promise<array<string>>}
 */
async function enumUsersApi(host) {
    const endpoints = ['/wp-json/wp/v2/users', '?rest_route=/wp/v2/users']
    let users = []

    for (let endpoint of endpoints) {
        try {
            const url = host + endpoint
            const res = await fetch(url)

            if (res.status === 200 && res.headers.get('content-type').includes('json')) {
                const usersApi = await res.json()

                for (const user of usersApi) {
                    if (utils.isDefined(user.slug) && !users.includes(user.slug)) {
                        users.push(user.slug)
                    }
                }
            }
        } catch (error) {
            utils.logging.error(error)
        }
    }

    return users
}

/**
 * Recursive function to enumerate users by index
 *
 * @async
 * @param {string} host
 * @param {number} i - Current index
 * @param {array<string>} users - List of users
 * @returns {Promise<array<string>>}
 */
async function enumUsersById(host, i, users) {
    let index = i || 1
    let _users = users || []
    let endpoint = host + '/?author=' + index

    try {
        const res = await fetch(endpoint)
        // if user id does not exist
        if (!res.ok) {
            return _users
        }

        const html = await res.text()
        const $ = await cheerio.load(html)
        index++
        _users.push($('body')[0].attribs.class.split('author-')[1].trim())
        await enumUsersById(host, index, _users)
    } catch (error) {
        if (error.status !== 404) {
            utils.logging.error(error)
        }

        return  _users
    }

    return _users
}

/**
 * Goes through different methods to enumerate users on WordPress
 *
 * @async
 * @param {string} host
 * @returns {Promise<array<string>>}
 */
async function getUsers(host) {
    console.log(`-> Starting user enumeration ...`)

    try {
        const apiUsers = await enumUsersApi(host)
        const idUsers = await enumUsersById(host, 1, null)
        const siteMapUsers = await enumUsersSitemap(host)

        if (!apiUsers.length && !idUsers.length && !siteMapUsers.length) {
            console.error(`${ utils.printCheck.failure() } No user was found`)
            utils.exit(0)
        }

        return utils.uniq(apiUsers.concat(idUsers, siteMapUsers))
    } catch (error) {
        utils.logging.error(error)
    }
}


export { getUsers }
