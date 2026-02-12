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

                if (authorsLink?.length) {
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
    const endpoints = ['/wp-json/wp/v2/users', '/?rest_route=/wp/v2/users']
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
 * Enumerate users by iterating author IDs
 * Tolerates gaps by allowing consecutive misses before stopping
 *
 * @async
 * @param {string} host
 * @returns {Promise<array<string>>}
 */
async function enumUsersById(host) {
    const users = []
    // If a user is deleted it create a gap between the ids
    const maxConsecutiveMisses = 10
    let consecutiveMisses = 0

    for (let id = 1; consecutiveMisses < maxConsecutiveMisses; id++) {
        try {
            const res = await fetch(host + '/?author=' + id)

            if (!res.ok) {
                consecutiveMisses++
                continue
            }

            consecutiveMisses = 0
            const html = await res.text()
            const $ = cheerio.load(html)
            const bodyClass = $('body').attr('class') || ''
            const authorMatch = bodyClass.split('author-')[1]

            if (authorMatch) {
                users.push(authorMatch.trim().split(' ')[0])
            }
        } catch (error) {
            consecutiveMisses++
            utils.logging.error(error)
        }
    }

    return users
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
        const [
            apiUsersRes,
            idUsersRes,
            sitemapUsersRes
        ] = await Promise.allSettled([
            enumUsersApi(host),
            enumUsersById(host),
            enumUsersSitemap(host)
        ])

        const apiUsers = apiUsersRes.status === "fulfilled" ? apiUsersRes.value : []
        const idUsers = idUsersRes.status === "fulfilled" ? idUsersRes.value : []
        const siteMapUsers = sitemapUsersRes.status === "fulfilled" ? sitemapUsersRes.value : []

        if (!apiUsers.length && !idUsers.length && !siteMapUsers.length) {
            console.error(`${ utils.printCheck.failure() } No user was found`)
            utils.exit(1)
        }

        return utils.uniq(apiUsers.concat(idUsers, siteMapUsers))
    } catch (error) {
        utils.logging.error(error)
        utils.exit(1)
    }
}


export { getUsers }
