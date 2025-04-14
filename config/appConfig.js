import path from 'path'


const appConfig = {
    app: {
        rootPath: path.resolve(),
        pluginFilePath: '/plugin/wp-plugin.php',
        archivePath: '/plugin/wp-plugin.zip'
    },
    host: {
        url: 'http://localhost/wordpress/'
    },
    bruteforce: {
        wordlist: '/wordlist/passwords-1000.txt',
        concurrencyLimit: 50,
        userAgent: "WP Test"
    },
    debug: false,
}


export { appConfig }
