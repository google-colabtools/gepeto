// External
import playwright, { BrowserContext } from 'rebrowser-playwright'
import { newInjectedContext } from 'fingerprint-injector'
import { FingerprintGenerator } from 'fingerprint-generator'

// Built-in
import * as fs from 'fs';

// Internals
import { MicrosoftRewardsBot } from '../index'
import { loadSessionData, saveFingerprintData } from '../util/Load'
import { updateFingerprintUserAgent } from '../util/UserAgent'

import { AccountProxy } from '../interface/Account'

/* Test Stuff
https://abrahamjuliot.github.io/creepjs/
https://botcheck.luminati.io/
https://fv.pro/
https://pixelscan.net/
https://www.browserscan.net/
*/

class Browser {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async createBrowser(proxy: AccountProxy, email: string): Promise<BrowserContext> {
        const getBrowserPath = () => {
        const thoriumPath = process.env.THORIUM_BIN;
        const chromePath = process.env.CHROME_BIN;
        const fallbackPath = '/usr/bin/chromium';

        if (thoriumPath && fs.existsSync(thoriumPath)) {
            console.log(`Usando THORIUM_BIN: ${thoriumPath}`);
            return thoriumPath;
        }

        if (chromePath && fs.existsSync(chromePath)) {
            console.log(`THORIUM_BIN não encontrado. Usando CHROME_BIN: ${chromePath}`);
            return chromePath;
        }

        console.log(`Nenhum dos envs encontrados ou válidos. Usando fallback: ${fallbackPath}`);
        return fallbackPath;
        };
        
        const browser = await playwright.chromium.launch({
            executablePath: getBrowserPath(),
            headless: this.bot.config.headless,
            ...(proxy.url && { proxy: { username: proxy.username, password: proxy.password, server: `${proxy.url}:${proxy.port}` } }),
            args: [
                '--disable-background-networking',
                '--test-type', // Test mode
                '--disable-quic', // Disable QUIC connection
                '--no-first-run', // Skip first run check
                '--blink-settings=imagesEnabled=false', // Disable image loading
                '--no-sandbox', // Disable sandbox mode
                '--mute-audio', // Disable audio
                '--disable-setuid-sandbox', // Disable setuid sandbox
                '--ignore-certificate-errors', // Ignore all certificate errors
                '--ignore-certificate-errors-spki-list', // Ignore certificate errors for specified SPKI list
                '--ignore-ssl-errors', // Ignore SSL errors
                '--dns-over-https="https://dns.google/dns-query"', // Use DNS over HTTPS
            ]
        })

        const sessionData = await loadSessionData(this.bot.config.sessionPath, email, this.bot.isMobile, this.bot.config.saveFingerprint)

        const fingerprint = sessionData.fingerprint ? sessionData.fingerprint : await this.generateFingerprint()

        const context = await newInjectedContext(browser as any, { fingerprint: fingerprint })

        //阻止图片加载以节省数据流量
        await context.route('**/*', (route) => {
            const resourceType = route.request().resourceType()
            const url = route.request().url()
        
            // Bloquear imagens
            if (resourceType === 'image' || resourceType === 'media') {
                return route.abort()
            }
        
            // Bloquear fontes (resourceType font ou extensão conhecida)
            if (
                resourceType === 'font' ||
                url.endsWith('.woff') ||
                url.endsWith('.woff2') ||
                url.endsWith('.ttf') ||
                url.endsWith('.otf')
            ) {
                return route.abort()
            }
        
            return route.continue()
        })

        // Set timeout to preferred amount
        context.setDefaultTimeout(this.bot.utils.stringToMs(this.bot.config?.globalTimeout ?? 30000))

        await context.addCookies(sessionData.cookies)

        if (this.bot.config.saveFingerprint) {
            await saveFingerprintData(this.bot.config.sessionPath, email, this.bot.isMobile, fingerprint)
        }

        this.bot.log(this.bot.isMobile, 'BROWSER', `Created browser with User-Agent: "${fingerprint.fingerprint.navigator.userAgent}"`)

        return context as BrowserContext
    }

    async generateFingerprint() {
        const fingerPrintData = new FingerprintGenerator().getFingerprint({
            devices: this.bot.isMobile ? ['mobile'] : ['desktop'],
            operatingSystems: this.bot.isMobile ? ['android'] : ['windows'],
            browsers: [{ name: 'edge' }]
        })

        const updatedFingerPrintData = await updateFingerprintUserAgent(fingerPrintData, this.bot.isMobile)

        return updatedFingerPrintData
    }
}

export default Browser
