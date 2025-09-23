import { randomBytes } from 'crypto'
import { AxiosRequestConfig } from 'axios'

import { Workers } from '../Workers'

import { DashboardData } from '../../interface/DashboardData'


export class ReadToEarn extends Workers {
    /**
     * Calculate reduced delay for Read to Earn (20-50% reduction)
     * @param minDelay Original minimum delay in milliseconds
     * @param maxDelay Original maximum delay in milliseconds
     * @returns Object with reduced min and max delays
     */
    private getReducedDelay(minDelay: number, maxDelay: number): { min: number, max: number } {
        // Generate random reduction percentage between 20% and 50%
        const reductionPercentage = this.bot.utils.randomNumber(0.2, 0.5)
        
        const reducedMin = Math.floor(minDelay * (1 - reductionPercentage))
        const reducedMax = Math.floor(maxDelay * (1 - reductionPercentage))
        
        // Ensure minimum delay is at least 100ms to avoid too aggressive timing
        const finalMin = Math.max(reducedMin, 100)
        const finalMax = Math.max(reducedMax, finalMin + 100)
        
        return { min: finalMin, max: finalMax }
    }

    public async doReadToEarn(accessToken: string, data: DashboardData) {
        this.bot.log(this.bot.isMobile, 'READ-TO-EARN', 'Starting Read to Earn')

        try {
            let geoLocale = data.userProfile.attributes.country
            geoLocale = (this.bot.config.searchSettings.useGeoLocaleQueries && geoLocale.length === 2) ? geoLocale.toLowerCase() : 'cn'

            const userDataRequest: AxiosRequestConfig = {
                url: 'https://prod.rewardsplatform.microsoft.com/dapi/me',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Rewards-Country': geoLocale,
                    'X-Rewards-Language': 'zh'
                }
            }
            const userDataResponse = await this.bot.axios.request(userDataRequest)
            const userData = (await userDataResponse.data).response
            let userBalance = userData.balance

            const jsonData = {
                amount: 1,
                country: geoLocale,
                id: '1',
                type: 101,
                attributes: {
                    offerid: 'ENUS_readarticle3_30points'
                }
            }

            const articleCount = 10
            for (let i = 0; i < articleCount; ++i) {
                jsonData.id = randomBytes(64).toString('hex')
                const claimRequest = {
                    url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Rewards-Country': geoLocale,
                        'X-Rewards-Language': 'zh'
                    },
                    data: JSON.stringify(jsonData)
                }

                const claimResponse = await this.bot.axios.request(claimRequest)
                const newBalance = (await claimResponse.data).response.balance

                if (newBalance == userBalance) {
                    this.bot.log(this.bot.isMobile, 'READ-TO-EARN', 'Read all available articles')
                    break
                } else {
                    this.bot.log(this.bot.isMobile, 'READ-TO-EARN', `Read article ${i + 1} of ${articleCount} max | Gained ${newBalance - userBalance} Points`)
                    userBalance = newBalance
                    
                    // Calculate reduced delays specifically for Read to Earn (20-50% reduction)
                    const originalMinMs = this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.min)
                    const originalMaxMs = this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.max)
                    const reducedDelays = this.getReducedDelay(originalMinMs, originalMaxMs)
                    
                    const delayTime = Math.floor(this.bot.utils.randomNumber(reducedDelays.min, reducedDelays.max))
                    await this.bot.utils.wait(delayTime)
                }
            }

            this.bot.log(this.bot.isMobile, 'READ-TO-EARN', 'Completed Read to Earn')
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'READ-TO-EARN', 'An error occurred:' + error, 'error')
        }
    }
}