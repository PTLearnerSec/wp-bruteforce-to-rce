import path from 'path'


const appConfig = {
    app: {
        rootPath: path.resolve(),
        pluginFilePath: '/plugin/wp-plugin.php',
        archivePath: '/plugin/wp-plugin.zip'
    },
    host: {
        url: process.env.WP_TARGET_URL || ''
    },
    bruteforce: {
        wordlist: '/wordlist/passwords-1000.txt',
        concurrencyLimit: 50,
        userAgent: "WP Test"
    },
    proxy: {
        url: process.env.PROXY_URL || ''
    },
    debug: false
}


export { appConfig }
