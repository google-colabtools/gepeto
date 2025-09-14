import { Page } from 'rebrowser-playwright'
import { load } from 'cheerio'

import { MicrosoftRewardsBot } from '../index'


export default class BrowserUtil {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async tryDismissAllMessages(page: Page): Promise<void> {
        const buttons = [
            { selector: 'button[type="submit"]', label: 'Submit Button' },
            { selector: '#acceptButton', label: 'AcceptButton' },
            { selector: '.ext-secondary.ext-button', label: '"Skip for now" Button' },
            { selector: '#iLandingViewAction', label: 'iLandingViewAction' },
            { selector: '#iShowSkip', label: 'iShowSkip' },
            //{ selector: '#iNext', label: 'iNext' },
            { selector: '#iLooksGood', label: 'iLooksGood' },
            { selector: '#idSIButton9', label: 'idSIButton9' },
            { selector: '.ms-Button.ms-Button--primary', label: 'Primary Button' },
            { selector: '.c-glyph.glyph-cancel', label: 'Mobile Welcome Button' },
            { selector: '.maybe-later', label: 'Mobile Rewards App Banner' },
            { selector: '//div[@id="cookieConsentContainer"]//button[contains(text(), "Accept")]', label: 'Accept Cookie Consent Container', isXPath: true },
            { selector: '#bnp_btn_accept', label: 'Bing Cookie Banner' },
            { selector: '#reward_pivot_earn', label: 'Reward Coupon Accept' },
            { selector: '#bnp_overlay_wrapper', label: 'Bing Privacy Overlay' },
            { selector: 'button:has-text("Accept")', label: 'Accept Button' },
            { selector: 'button:has-text("Allow")', label: 'Allow Button' },
            { selector: 'button:has-text("Continue")', label: 'Continue Button' },
            { selector: 'button:has-text("OK")', label: 'OK Button' },
            { selector: 'button:has-text("Got it")', label: 'Got it Button' },
            { selector: '[data-testid="close"]', label: 'Close Button' },
            { selector: '[data-testid="dismiss"]', label: 'Dismiss Button' },
            { selector: '[aria-label="Close"]', label: 'Close Aria Label' },
            { selector: '[aria-label="Dismiss"]', label: 'Dismiss Aria Label' }
        ]

        for (const button of buttons) {
            try {
                // Only create locator when needed, avoiding unnecessary references
                const element = button.isXPath ? page.locator(`xpath=${button.selector}`) : page.locator(button.selector)
                await element.first().click({ timeout: 1000 })
                await page.waitForTimeout(500)
                
                this.bot.log(this.bot.isMobile, 'DISMISS-ALL-MESSAGES', `Dismissed: ${button.label}`)
                // Release element reference
            } catch (error) {
                // Silent fail for expected errors
            }
        }
    }

    async getLatestTab(page: Page): Promise<Page> {
        try {
            const pages = page.context().pages()
            if (!pages || pages.length === 0) {
                throw new Error('No pages found in context')
            }

            // Get the last unclosed page
            const activePage = pages.filter((p: Page) => !p.isClosed()).pop()
            if (!activePage) {
                throw new Error('No active pages found')
            }

            return activePage
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'GET-NEW-TAB', 'Unable to get latest tab')
            this.bot.log(this.bot.isMobile, 'GET-NEW-TAB', `An error occurred: ${error}`, 'error')
            
            // If unable to get new tab, return original page instead of undefined
            return page
        }
    }

    async getTabs(page: Page) {
        try {
            const browser = page.context()
            const pages = browser.pages()

            // Only keep necessary page references, avoid unnecessary references
            const homeTab = pages[1]
            let homeTabURL: URL

            if (!homeTab) {
                throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Home tab could not be found!', 'error')
            } else {
                homeTabURL = new URL(homeTab.url())
                if (homeTabURL.hostname !== 'rewards.bing.com') {
                    throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Reward page hostname is invalid: ' + homeTabURL.host, 'error')
                }
            }

            const workerTab = pages[2]
            if (!workerTab) {
                throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'Worker tab could not be found!', 'error')
            }

            // Only return necessary tabs
            return {
                homeTab,
                workerTab
            }
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'GET-TABS', 'An error occurred:' + error, 'error')
        }
    }

    async reloadBadPage(page: Page): Promise<void> {
        try {
            // Only parse HTML when network error is detected, reducing memory allocation
            const html = await page.content().catch(() => '')
            if (html.includes('neterror')) {
                const $ = load(html)
                const isNetworkError = $('body.neterror').length
                if (isNetworkError) {
                    this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'Bad page detected, reloading!')
                    await page.reload()
                }
            }
        } catch (error) {
            throw this.bot.log(this.bot.isMobile, 'RELOAD-BAD-PAGE', 'An error occurred:' + error, 'error')
        }
    }

}
