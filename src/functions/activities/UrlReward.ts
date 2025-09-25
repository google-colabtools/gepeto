import { Page } from 'rebrowser-playwright'

import { Workers } from '../Workers'


export class UrlReward extends Workers {

    async doUrlReward(page: Page) {
        this.bot.log(this.bot.isMobile, 'URL Reward', 'Attempting to complete URL reward')
        const probability = this.bot.utils.randomNumber(1,100);
        // 70% chance to run randomly
        if (this.bot.config.searchSettings.scrollRandomResults && probability <=70) {
            await this.bot.utils.waitRandom(2000,5000, 'normal')
            await this.randomScroll(page)
        }
        try {
            this.bot.utils.waitRandom(10000,18000, 'normal')

            await page.close()

            this.bot.log(this.bot.isMobile, 'URL Reward', 'Successfully completed URL reward')
        } catch (error) {
            await page.close()
            this.bot.log(this.bot.isMobile, 'URL Reward', 'An error occurred:' + error, 'error')
        }
    }
    /**
     * Perform random scroll operations on the results page
     * @param page - Page object of the results page
     */
    private async randomScroll(page: Page) {
        try {
            const viewportHeight = await page.evaluate(() => window.innerHeight)
            const totalHeight = await page.evaluate(() => document.body.scrollHeight)
            const randomScrollPosition = this.bot.utils.randomNumber(0, totalHeight - viewportHeight, 'normal')

            await page.evaluate((scrollPos) => {
                window.scrollTo(0, scrollPos)
            }, randomScrollPosition)

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-RANDOM-SCROLL', 'An error occurred:' + error, 'error')
        }
    }

}
