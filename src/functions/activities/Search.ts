import { Page } from 'rebrowser-playwright'
import { platform } from 'os'

import { Workers } from '../Workers'

import { Counters, DashboardData } from '../../interface/DashboardData'
import { GoogleSearch } from '../../interface/Search'
import { AxiosRequestConfig } from 'axios'

type GoogleTrendsResponse = [
    string,
    [
        string,
        ...null[],
        [string, ...string[]]
    ][]
];

export class Search extends Workers {
    private bingHome = 'https://bing.com'
    private searchPageURL = ''
    private firstScroll: boolean = true;
    private randomSearchLimit: number = 0; // Limite aleatório de pontos para completar as pesquisas

    public async doSearch(page: Page, data: DashboardData) {
        this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Starting Bing searches')

        page = await this.bot.browser.utils.getLatestTab(page)

        let searchCounters: Counters = await this.bot.browser.func.getSearchPoints()
        let missingPoints = this.calculatePoints(searchCounters)

        if (missingPoints === 0) {
            this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Bing searches have already been completed')
            return
        }

        // Calcular limite aleatório baseado em 87-100% dos pontos totais possíveis
        const totalPossiblePoints = this.calculateTotalPossiblePoints(searchCounters)
        
        // Exceção: se o máximo possível for <= 50, completar todos os pontos
        if (totalPossiblePoints <= 50) {
            this.randomSearchLimit = totalPossiblePoints
            this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Low points detected (${totalPossiblePoints} <= 50), completing all points without random limit`)
        } else {
            const randomPercentage = this.bot.utils.randomNumber(87, 100) / 100
            this.randomSearchLimit = Math.ceil(totalPossiblePoints * randomPercentage)
            this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Random search limit set to ${this.randomSearchLimit} points (${(randomPercentage * 100).toFixed(1)}% of ${totalPossiblePoints})`)
        }

        // Generate search queries
        let googleSearchQueries = await this.getGoogleTrends(this.bot.config.searchSettings.useGeoLocaleQueries ? data.userProfile.attributes.country : 'US')
        googleSearchQueries = this.bot.utils.shuffleArray(googleSearchQueries)

        // Deduplicate the search terms
        googleSearchQueries = [...new Set(googleSearchQueries)]

        // Go to bing
        await page.goto(this.searchPageURL ? this.searchPageURL : this.bingHome)

        await this.bot.utils.wait(2000)

        await this.bot.browser.utils.tryDismissAllMessages(page)

        let maxLoop = 0 // If the loop hits 10 this when not gaining any points, we're assuming it's stuck. If it doesn't continue after 5 more searches with alternative queries, abort search

        const queries: string[] = []
        // Mobile search doesn't seem to like related queries?
        googleSearchQueries.forEach(x => { this.bot.isMobile ? queries.push(x.topic) : queries.push(x.topic, ...x.related) })

        // Loop over Google search queries
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i] as string

            this.bot.log(this.bot.isMobile, 'SEARCH-BING', `${missingPoints} Points Remaining | Query: ${query}`)

            searchCounters = await this.bingSearch(page, query)
            const newMissingPoints = this.calculatePoints(searchCounters)

            // If the new point amount is the same as before
            if (newMissingPoints == missingPoints) {
                maxLoop++ // Add to max loop
            } else { // There has been a change in points
                maxLoop = 0 // Reset the loop
            }

            missingPoints = newMissingPoints

            // Verificar se atingiu o limite aleatório definido
            if (this.hasReachedRandomLimit(searchCounters)) {
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Reached random search limit of ${this.randomSearchLimit} points`)
                break
            }

            // Only for mobile searches
            if (maxLoop > 5 && this.bot.isMobile) {
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Search didn\'t gain point for 5 iterations, likely bad User-Agent', 'warn')
                break
            }

            // If we didn't gain points for 10 iterations, assume it's stuck
            if (maxLoop > 10) {
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Search didn\'t gain point for 10 iterations aborting searches', 'warn')
                maxLoop = 0 // Reset to 0 so we can retry with related searches below
                break
            }
        }

        // Only for mobile searches
        if (missingPoints > 0 && this.bot.isMobile && !this.hasReachedRandomLimit(searchCounters)) {
            return
        }

        // If we still got remaining search queries and haven't reached random limit, generate extra ones
        if (missingPoints > 0 && !this.hasReachedRandomLimit(searchCounters)) {
            this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Search completed but we're missing ${missingPoints} points and haven't reached random limit (${this.randomSearchLimit}), generating extra searches`)

            let i = 0
            while (missingPoints > 0 && !this.hasReachedRandomLimit(searchCounters)) {
                const query = googleSearchQueries[i++] as GoogleSearch

                // Get related search terms to the Google search queries
                const relatedTerms = await this.getRelatedTerms(query?.topic)
                if (relatedTerms.length > 3) {
                    // Search for the first 2 related terms
                    for (const term of relatedTerms.slice(1, 3)) {
                        this.bot.log(this.bot.isMobile, 'SEARCH-BING-EXTRA', `${missingPoints} Points Remaining | Query: ${term}`)

                        searchCounters = await this.bingSearch(page, term)
                        const newMissingPoints = this.calculatePoints(searchCounters)

                        // If the new point amount is the same as before
                        if (newMissingPoints == missingPoints) {
                            maxLoop++ // Add to max loop
                        } else { // There has been a change in points
                            maxLoop = 0 // Reset the loop
                        }

                        missingPoints = newMissingPoints

                        // If we satisfied the searches
                        if (this.hasReachedRandomLimit(searchCounters)) {
                            this.bot.log(this.bot.isMobile, 'SEARCH-BING-EXTRA', `Reached random search limit of ${this.randomSearchLimit} points`)
                            break
                        }

                        // Try 5 more times, then we tried a total of 15 times, fair to say it's stuck
                        if (maxLoop > 5) {
                            this.bot.log(this.bot.isMobile, 'SEARCH-BING-EXTRA', 'Search didn\'t gain point for 5 iterations aborting searches', 'warn')
                            return
                        }
                    }
                }
            }
        }

        // Log final status
        const finalCounters = await this.bot.browser.func.getSearchPoints()
        const finalPoints = this.calculateCurrentPoints(finalCounters)
        const completionPercentage = ((finalPoints / this.calculateTotalPossiblePoints(finalCounters)) * 100).toFixed(1)
        
        this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Search farming completed - ${finalPoints}/${this.calculateTotalPossiblePoints(finalCounters)} points (${completionPercentage}%) | Random limit was: ${this.randomSearchLimit}`)
    }

    private async bingSearch(searchPage: Page, query: string) {
        const platformControlKey = platform() === 'darwin' ? 'Meta' : 'Control'
        // Initialize search content for each search
        this.firstScroll = true
        // Try a max of 5 times
        for (let i = 0; i < 5; i++) {
            try {
                // This page had already been set to the Bing.com page or the previous search listing, we just need to select it
                searchPage = await this.bot.browser.utils.getLatestTab(searchPage)

                // Go to top of the page
                await searchPage.evaluate(() => {
                    window.scrollTo(0, 0)
                })

                await this.bot.utils.wait(this.bot.utils.randomNumber(500, 2000))

                const searchBar = '#sb_form_q'
                await searchPage.waitForSelector(searchBar, { state: 'visible', timeout: 10000 })
                // Simulate mouse movement to search bar and hover before clicking
                await searchPage.hover(searchBar);
                await this.bot.utils.waitRandom(200, 500); // 悬停停顿
                await searchPage.click(searchBar); // Focus on the textarea
                await this.bot.utils.wait(this.bot.utils.randomNumber(500, 2000))
                await searchPage.keyboard.down(platformControlKey)
                await searchPage.keyboard.press('A')
                await searchPage.keyboard.press('Backspace')
                await searchPage.keyboard.up(platformControlKey)
                // Simulate human typing speed, adding random pauses between each character
                for (const char of query) {
                    await searchPage.keyboard.type(char);
                    await this.bot.utils.wait(this.bot.utils.randomNumber(50, 200)); // 50-200ms random pause
                }
                await searchPage.keyboard.press('Enter')

                await this.bot.utils.wait(this.bot.utils.randomNumber(3000, 5000))

                // Bing.com in Chrome opens a new tab when searching
                const resultPage = await this.bot.browser.utils.getLatestTab(searchPage)
                this.searchPageURL = new URL(resultPage.url()).href // Set the results page

                await this.bot.browser.utils.reloadBadPage(resultPage)
                await this.bot.browser.utils.tryDismissAllMessages(resultPage)

                // Randomly loop 1-3 times to perform scroll and click operations
                const loopCount = this.bot.utils.randomNumber(1, 3);
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Starting ${loopCount} random scroll and click loops`);
                for (let i = 0; i < loopCount; i++) {
                    if (this.bot.config.searchSettings.scrollRandomResults) {
                        await this.bot.utils.wait(this.bot.utils.randomNumber(2000, 4000))
                        await this.humanLikeScroll(resultPage)
                    }

                    const clickProbability = this.bot.utils.randomNumber(1, 100);
                    // 70% probability to click
                    if (this.bot.config.searchSettings.clickRandomResults && clickProbability <= 70) {
                        await this.bot.utils.wait(this.bot.utils.randomNumber(2000, 4000))
                        await this.clickRandomLink(resultPage)
                    }

                    // Add random wait between loops (no wait after last loop)
                    if (i < loopCount - 1) {
                        await this.bot.utils.waitRandom(2000, 5000);
                    }
                }

                // Delay between searches
                await this.bot.utils.wait(Math.floor(this.bot.utils.randomNumber(this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.min), this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.max))))

                return await this.bot.browser.func.getSearchPoints()

            } catch (error) {
                if (i === 5) {
                    this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Failed after 5 retries... An error occurred:' + error, 'error')
                    break

                }

                await this.bot.browser.utils.tryDismissAllMessages(searchPage)

                this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Search failed, An error occurred:' + error, 'error')
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Retrying search, attempt ${i}/5`, 'warn')

                // Reset the tabs
                const lastTab = await this.bot.browser.utils.getLatestTab(searchPage)
                await this.closeTabs(lastTab)

                await this.bot.utils.wait(this.bot.utils.randomNumber(4000, 7000))
            }
        }

        this.bot.log(this.bot.isMobile, 'SEARCH-BING', 'Search failed after 5 retries, ending', 'error')
        return await this.bot.browser.func.getSearchPoints()
    }

    private async getGoogleTrends(geoLocale: string = 'US'): Promise<GoogleSearch[]> {
        const queryTerms: GoogleSearch[] = []
        this.bot.log(this.bot.isMobile, 'SEARCH-GOOGLE-TRENDS', `Generating search queries, can take a while! | GeoLocale: ${geoLocale}`)

        try {
            const request: AxiosRequestConfig = {
                url: 'https://trends.google.com/_/TrendsUi/data/batchexecute',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                data: `f.req=[[[i0OFE,"[null, null, \\"${geoLocale.toUpperCase()}\\", 0, null, 48]"]]]`
            }

            const response = await this.bot.axios.request(request, this.bot.config.proxy.proxyGoogleTrends)
            const rawText = response.data

            const trendsData = this.extractJsonFromResponse(rawText)
            if (!trendsData) {
               throw  this.bot.log(this.bot.isMobile, 'SEARCH-GOOGLE-TRENDS', 'Failed to parse Google Trends response', 'error')
            }

            const mappedTrendsData = trendsData.map(query => [query[0], query[9]!.slice(1)])
            if (mappedTrendsData.length < 90) {
                this.bot.log(this.bot.isMobile, 'SEARCH-GOOGLE-TRENDS', 'Insufficient search queries, falling back to US', 'warn')
                return this.getGoogleTrends()
            }

            for (const [topic, relatedQueries] of mappedTrendsData) {
                queryTerms.push({
                    topic: topic as string,
                    related: relatedQueries as string[]
                })
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-GOOGLE-TRENDS', 'An error occurred:' + error, 'error')
        }

        return queryTerms
    }

    private extractJsonFromResponse(text: string): GoogleTrendsResponse[1] | null {
        const lines = text.split('\n')
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    return JSON.parse(JSON.parse(trimmed)[0][2])[1]
                } catch {
                    continue
                }
            }
        }

        return null
    }

    private async getRelatedTerms(term: string): Promise<string[]> {
        try {
            const request = {
                url: `https://api.bing.com/osjson.aspx?query=${term}`,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }

            const response = await this.bot.axios.request(request, this.bot.config.proxy.proxyBingTerms)

            return response.data[1] as string[]
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-BING-RELATED', 'An error occurred:' + error, 'error')
        }

        return []
    }

   /**
     * Simulate human scrolling behavior, including acceleration, deceleration, and random pauses
     * @param page - Current page object
     */
    private async humanLikeScroll(page: Page) {
        // Get current scroll position and page height
        const [currentY, scrollHeight, windowHeight] = await Promise.all([
            page.evaluate(() => window.scrollY),
            page.evaluate(() => document.body.scrollHeight),
            page.evaluate(() => window.innerHeight)
        ]);
        const maxScroll = scrollHeight - windowHeight;

        // Set scroll parameters based on device type
        let scrollParams;
        if (this.bot.isMobile) {
            // Mobile device parameters: simulate touch swipe
            scrollParams = {
                minOffset: 200,
                maxOffset: 500,
                minDuration: 2000,
                maxDuration: 4000,
                minPause: 1000,
                maxPause: 3000,
                segments: 1 // Single scroll
            };
        } else {
            // Desktop device parameters: simulate mouse wheel segmented scrolling
            scrollParams = {
                minOffset: 50,
                maxOffset: 150,
                minDuration: 500,
                maxDuration: 1500,
                minPause: 500,
                maxPause: 1000,
                segments: this.bot.utils.randomNumber(2, 4) // 2-4 segment scrolling
            };
        }

        // Calculate scroll offset, first scroll must be downward
        let offset;
        if (this.firstScroll) {
            // First scroll downward
            offset = this.bot.utils.randomNumber(scrollParams.minOffset, scrollParams.maxOffset);
            this.firstScroll = false;
        } else {
            // Random up/down scrolling
            if (Math.random() < 0.7) { // 70% probability to generate larger absolute values
                if (Math.random() < 0.5) {
                    offset = this.bot.utils.randomNumber(-scrollParams.maxOffset, -scrollParams.minOffset);
                } else {
                    offset = this.bot.utils.randomNumber(scrollParams.minOffset, scrollParams.maxOffset);
                }
            } else { // 30% probability to generate middle range values
                offset = this.bot.utils.randomNumber(-scrollParams.minOffset, scrollParams.minOffset);
            }
        }
        
        // Calculate target position, ensure within valid range
        // Execute different scrolling strategies based on device type
        if (!this.bot.isMobile && scrollParams.segments > 1) {
            let remainingOffset = offset;
            let currentPosition = currentY;
            
            for (let i = 0; i < scrollParams.segments; i++) {
                // Calculate offset for each segment, handle remaining part in last segment
                const segmentOffset = i < scrollParams.segments - 1 
                    ? Math.floor(remainingOffset / (scrollParams.segments - i))
                    : remainingOffset;
                
                const targetPosition = Math.max(0, Math.min(currentPosition + segmentOffset, maxScroll));
                const duration = this.bot.utils.randomNumber(scrollParams.minDuration, scrollParams.maxDuration);
                const startTime = Date.now();

                await page.evaluate(({ currentPosition, targetPosition, duration, startTime }: { currentPosition: number, targetPosition: number, duration: number, startTime: number }) => {
                    return new Promise<void>(resolve => {
                        const animateScroll = () => {
                            const elapsed = Date.now() - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            
                            // Use easeInOutQuad easing function
                            const easeProgress = progress < 0.5 
                                ? 2 * progress * progress 
                                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                            
                            const currentScroll = currentPosition + (targetPosition - currentPosition) * easeProgress;
                            window.scrollTo(0, currentScroll);
                            
                            if (progress < 1) {
                                requestAnimationFrame(animateScroll);
                            } else {
                                resolve();
                            }
                        };
                        
                        animateScroll();
                    });
                }, { currentPosition, targetPosition, duration, startTime });

                // Update current position and remaining offset
                currentPosition = targetPosition;
                remainingOffset -= segmentOffset;

                // Pause between segments (no pause after last segment)
                if (i < scrollParams.segments - 1) {
                    await this.bot.utils.wait(this.bot.utils.randomNumber(scrollParams.minPause, scrollParams.maxPause));
                }
            }
        } else {
            // Single scroll (mobile device or desktop single segment scrolling)
            const targetPosition = Math.max(0, Math.min(currentY + offset, maxScroll));
            const duration = this.bot.utils.randomNumber(scrollParams.minDuration, scrollParams.maxDuration);
            const startTime = Date.now();

            await page.evaluate(({ currentY, targetPosition, duration, startTime }: { currentY: number, targetPosition: number, duration: number, startTime: number }) => {
                return new Promise<void>(resolve => {
                    const animateScroll = () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Use easeInOutQuad easing function
                        const easeProgress = progress < 0.5 
                            ? 2 * progress * progress 
                            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                        
                        const currentScroll = currentY + (targetPosition - currentY) * easeProgress;
                        window.scrollTo(0, currentScroll);
                        
                        if (progress < 1) {
                            requestAnimationFrame(animateScroll);
                        } else {
                            resolve();
                        }
                    };
                    
                    animateScroll();
                });
            }, { currentY, targetPosition, duration, startTime });
        }

        // Final pause
        await this.bot.utils.wait(this.bot.utils.randomNumber(scrollParams.minPause, scrollParams.maxPause));
    }

    private async clickRandomLink(page: Page) {
        try {
            // Get title links in search results
            const resultLinks = await page.locator('#b_results .b_algo h2').all();
            // Filter visible links
            const visibleLinks = [];
            for (const link of resultLinks) {
                if (await link.isVisible()) {
                    visibleLinks.push(link);
                }
            }
            if (visibleLinks.length <= 0) {
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', `No visible links`);
                return
            }
            const randomLink = visibleLinks[this.bot.utils.randomNumber(0, visibleLinks.length - 1)];
            if (randomLink) await randomLink.hover();
            await this.bot.utils.wait(this.bot.utils.randomNumber(1000, 2000));
            // Cancel hover
            if (randomLink) await page.mouse.move(0, 0);
            // 30% probability for hover only
            const clickProbability = this.bot.utils.randomNumber(1, 100);
            if (clickProbability <= 30) {
                this.bot.log(this.bot.isMobile, 'SEARCH-BING', `Performing hover-only and returning (probability: ${clickProbability}%)`);
                return
            }
            if (randomLink) {
                await randomLink.click({ timeout: 2000 }).catch(() => { });
            }
            
            // Only used if the browser is not the edge browser (continue on Edge popup)
            await this.closeContinuePopup(page)

            // Stay for 10 seconds for page to load and "visit"
            await this.bot.utils.wait(this.bot.utils.randomNumber(10000, 30000))

            // Will get current tab if no new one is created, this will always be the visited site or the result page if it failed to click
            let lastTab = await this.bot.browser.utils.getLatestTab(page)

            let lastTabURL = new URL(lastTab.url()) // Get new tab info, this is the website we're visiting

            // Check if the URL is different from the original one, don't loop more than 5 times.
            let i = 0
            while (lastTabURL.href !== this.searchPageURL && i < 5) {

                await this.closeTabs(lastTab)

                // End of loop, refresh lastPage
                lastTab = await this.bot.browser.utils.getLatestTab(page) // Finally update the lastTab var again
                lastTabURL = new URL(lastTab.url()) // Get new tab info
                i++
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-RANDOM-CLICK', 'An error occurred:' + error, 'error')
        }
    }

    private async closeTabs(lastTab: Page) {
        const browser = lastTab.context()
        const tabs = browser.pages()

        try {
            if (tabs.length > 2) {
                // If more than 2 tabs are open, close the last tab

                await lastTab.close()
                this.bot.log(this.bot.isMobile, 'SEARCH-CLOSE-TABS', `More than 2 were open, closed the last tab: "${new URL(lastTab.url()).host}"`)

            } else if (tabs.length === 1) {
                // If only 1 tab is open, open a new one to search in

                const newPage = await browser.newPage()
                await this.bot.utils.wait(1000)

                await newPage.goto(this.bingHome)
                await this.bot.utils.wait(3000)
                this.searchPageURL = newPage.url()

                this.bot.log(this.bot.isMobile, 'SEARCH-CLOSE-TABS', 'There was only 1 tab open, crated a new one')
            } else {
                // Else reset the last tab back to the search listing or Bing.com

                lastTab = await this.bot.browser.utils.getLatestTab(lastTab)
                await lastTab.goto(this.searchPageURL ? this.searchPageURL : this.bingHome)
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'SEARCH-CLOSE-TABS', 'An error occurred:' + error, 'error')
        }

    }

    private calculatePoints(counters: Counters) {
        const mobileData = counters.mobileSearch?.[0] // Mobile searches
        const genericData = counters.pcSearch?.[0] // Normal searches
        const edgeData = counters.pcSearch?.[1] // Edge searches

        const missingPoints = (this.bot.isMobile && mobileData)
            ? mobileData.pointProgressMax - mobileData.pointProgress
            : (edgeData ? edgeData.pointProgressMax - edgeData.pointProgress : 0)
            + (genericData ? genericData.pointProgressMax - genericData.pointProgress : 0)

        return missingPoints
    }

    private calculateTotalPossiblePoints(counters: Counters) {
        const mobileData = counters.mobileSearch?.[0] // Mobile searches
        const genericData = counters.pcSearch?.[0] // Normal searches
        const edgeData = counters.pcSearch?.[1] // Edge searches

        const totalPossible = (this.bot.isMobile && mobileData)
            ? mobileData.pointProgressMax
            : (edgeData ? edgeData.pointProgressMax : 0)
            + (genericData ? genericData.pointProgressMax : 0)

        return totalPossible
    }

    private hasReachedRandomLimit(counters: Counters): boolean {
        const mobileData = counters.mobileSearch?.[0] // Mobile searches
        const genericData = counters.pcSearch?.[0] // Normal searches
        const edgeData = counters.pcSearch?.[1] // Edge searches

        const currentPoints = (this.bot.isMobile && mobileData)
            ? mobileData.pointProgress
            : (edgeData ? edgeData.pointProgress : 0)
            + (genericData ? genericData.pointProgress : 0)

        return currentPoints >= this.randomSearchLimit
    }

    private calculateCurrentPoints(counters: Counters): number {
        const mobileData = counters.mobileSearch?.[0] // Mobile searches
        const genericData = counters.pcSearch?.[0] // Normal searches
        const edgeData = counters.pcSearch?.[1] // Edge searches

        const currentPoints = (this.bot.isMobile && mobileData)
            ? mobileData.pointProgress
            : (edgeData ? edgeData.pointProgress : 0)
            + (genericData ? genericData.pointProgress : 0)

        return currentPoints
    }

    private async closeContinuePopup(page: Page) {
        try {
            await page.waitForSelector('#sacs_close', { timeout: 1000 })
            const continueButton = await page.$('#sacs_close')

            if (continueButton) {
                await continueButton.click()
            }
        } catch (error) {
            // Continue if element is not found or other error occurs
        }
    }

}
