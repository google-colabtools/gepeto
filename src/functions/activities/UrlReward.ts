import { Page } from 'rebrowser-playwright'

import { Workers } from '../Workers'


export class UrlReward extends Workers {
    private firstScroll: boolean = true;

    /**
     * Calculate reduced delay for URL Reward (70-85% reduction)
     * @param minDelay Original minimum delay in milliseconds
     * @param maxDelay Original maximum delay in milliseconds
     * @returns Object with reduced min and max delays
     */
    private getReducedDelay(minDelay: number, maxDelay: number): { min: number, max: number } {
        // Generate random reduction percentage between 70% and 85%
        const reductionPercentage = this.bot.utils.randomNumber(0.7, 0.85)
        
        const reducedMin = Math.floor(minDelay * (1 - reductionPercentage))
        const reducedMax = Math.floor(maxDelay * (1 - reductionPercentage))
        
        // Ensure minimum delay is at least 50ms to avoid too aggressive timing
        const finalMin = Math.max(reducedMin, 50)
        const finalMax = Math.max(reducedMax, finalMin + 50)
        
        return { min: finalMin, max: finalMax }
    }

    async doUrlReward(page: Page) {
        this.bot.log(this.bot.isMobile, 'URL Reward', 'Attempting to complete URL reward')
        
        // Reset scroll state
        this.firstScroll = true;
        
        // Randomly loop 1-3 times to perform scroll and click operations (similar to Search.ts)
        const loopCount = this.bot.utils.randomNumber(1, 3);
        this.bot.log(this.bot.isMobile, 'URL-REWARD', `Starting ${loopCount} random scroll and click loops`);
        
        let interactionsMade = false; // Track if any interactions were successful
        
        for (let i = 0; i < loopCount; i++) {
            // 70% chance to scroll
            const scrollProbability = this.bot.utils.randomNumber(1, 100);
            if (this.bot.config.searchSettings.scrollRandomResults && scrollProbability <= 70) {
                await this.humanLikeScroll(page);
                interactionsMade = true;
            }

            // 50% chance to click on random element
            const clickProbability = this.bot.utils.randomNumber(1, 100);
            if (this.bot.config.searchSettings.clickRandomResults && clickProbability <= 50) {
                await this.clickRandomLink(page);
                interactionsMade = true; // This will be true even if no links found (fallback behavior)
            }

            // Add random wait between loops (no wait after last loop)
            if (i < loopCount - 1) {
                // Calculate reduced delays for inter-loop timing (70-85% reduction)
                const originalMinMs = this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.min)
                const originalMaxMs = this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.max)
                const reducedDelays = this.getReducedDelay(originalMinMs, originalMaxMs)
                
                const interLoopDelay = Math.floor(this.bot.utils.randomNumber(reducedDelays.min, reducedDelays.max))
                await this.bot.utils.wait(interLoopDelay)
            }
        }

        // Fallback: If no interactions were made (page might be empty or have no interactive elements)
        if (!interactionsMade) {
            this.bot.log(this.bot.isMobile, 'URL-REWARD', 'No interactions were possible, performing minimal page interaction');
            
            // Basic page interaction - just move mouse around and wait
            const fallbackMovements = this.bot.utils.randomNumber(1, 3);
            for (let i = 0; i < fallbackMovements; i++) {
                const randomX = this.bot.utils.randomNumber(100, 600);
                const randomY = this.bot.utils.randomNumber(100, 400);
                await page.mouse.move(randomX, randomY);
                await this.bot.utils.wait(this.bot.utils.randomNumber(800, 1500));
            }
            
            // Minimal wait to simulate page viewing
            await this.bot.utils.wait(this.bot.utils.randomNumber(1500, 3000));
        }

        try {
            // Calculate reduced delays for main URL reward timing (70-85% reduction)
            const originalMinMs = this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.min)
            const originalMaxMs = this.bot.utils.stringToMs(this.bot.config.searchSettings.searchDelay.max)
            const reducedDelays = this.getReducedDelay(originalMinMs, originalMaxMs)
            
            const mainDelayTime = Math.floor(this.bot.utils.randomNumber(reducedDelays.min, reducedDelays.max))
            await this.bot.utils.wait(mainDelayTime)

            const completionMessage = interactionsMade 
                ? 'Successfully completed URL reward with page interactions'
                : 'Successfully completed URL reward (minimal interaction mode)';
            this.bot.log(this.bot.isMobile, 'URL Reward', completionMessage)
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'URL Reward', 'Error occurred:' + error, 'error')
        }
    }
    /**
     * Simulate human scrolling behavior, including acceleration, deceleration, and random pauses
     * @param page - Current page object
     */
    private async humanLikeScroll(page: Page) {
        // Get current scroll position and page height
        const currentY =  await page.evaluate(() => window.scrollY)
        const maxScroll = await page.evaluate(() => document.body.scrollHeight) - await page.evaluate(() => window.innerHeight);

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
                    offset = this.bot.utils.randomNumber(scrollParams.maxOffset, scrollParams.maxOffset * 2);
                } else {
                    offset = -this.bot.utils.randomNumber(scrollParams.maxOffset, scrollParams.maxOffset * 2);
                }
            } else { // 30% probability to generate middle range values
                offset = this.bot.utils.randomNumber(-scrollParams.minOffset, scrollParams.minOffset);
            }
        }
        
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
                        const start = currentPosition;
                        const distance = targetPosition - start;
                        
                        function animateScroll() {
                            const elapsed = Date.now() - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            
                            // Ease-in-out function for smooth acceleration/deceleration
                            const easeInOut = progress < 0.5 
                                ? 2 * progress * progress 
                                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                            
                            const currentScroll = start + distance * easeInOut;
                            window.scrollTo(0, currentScroll);
                            
                            if (progress < 1) {
                                requestAnimationFrame(animateScroll);
                            } else {
                                resolve();
                            }
                        }
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
                    const start = currentY;
                    const distance = targetPosition - start;
                    
                    function animateScroll() {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Ease-in-out function for smooth acceleration/deceleration
                        const easeInOut = progress < 0.5 
                            ? 2 * progress * progress 
                            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                        
                        const currentScroll = start + distance * easeInOut;
                        window.scrollTo(0, currentScroll);
                        
                        if (progress < 1) {
                            requestAnimationFrame(animateScroll);
                        } else {
                            resolve();
                        }
                    }
                    animateScroll();
                });
            }, { currentY, targetPosition, duration, startTime });
        }

        // Final pause
        await this.bot.utils.wait(this.bot.utils.randomNumber(scrollParams.minPause, scrollParams.maxPause));
    }

    /**
     * Click on random links within the page to simulate human browsing behavior
     * @param page - Current page object
     */
    private async clickRandomLink(page: Page) {
        try {
            // First, try to dismiss any overlays or banners that might interfere
            await this.bot.browser.utils.tryDismissAllMessages(page);
            
            // Try to find clickable elements (links, buttons, etc.)
            const clickableSelectors = [
                'a[href]',           // Links
                'button',            // Buttons
                '[role="button"]',   // Elements with button role
                'input[type="submit"]', // Submit inputs
                '.clickable'         // Common clickable class
            ];

            const allLinks = [];
            for (const selector of clickableSelectors) {
                try {
                    const elements = await page.locator(selector).all();
                    for (const element of elements) {
                        if (await element.isVisible()) {
                            allLinks.push(element);
                        }
                    }
                } catch (e) {
                    // Continue if selector doesn't work
                }
            }

            if (allLinks.length <= 0) {
                this.bot.log(this.bot.isMobile, 'URL-REWARD', 'No clickable elements found, simulating page interaction instead');
                //screenlog
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
                const screenshotPath = `./url_rewards_no_clickable_${timestamp}.png`;
                await page.screenshot({ path: screenshotPath });
                // Fallback: simulate human behavior without clicking
                // Move mouse around randomly to simulate reading
                const mouseMovements = this.bot.utils.randomNumber(2, 4);
                for (let i = 0; i < mouseMovements; i++) {
                    const randomX = this.bot.utils.randomNumber(100, 800);
                    const randomY = this.bot.utils.randomNumber(100, 600);
                    await page.mouse.move(randomX, randomY);
                    await this.bot.utils.wait(this.bot.utils.randomNumber(500, 1500));
                }
                
                // Simulate reading time even without clicking
                const readingTime = this.bot.utils.randomNumber(2000, 5000);
                this.bot.log(this.bot.isMobile, 'URL-REWARD', `Simulating reading for ${readingTime}ms without clicks`);
                await this.bot.utils.wait(readingTime);
                
                return;
            }

            const randomElement = allLinks[this.bot.utils.randomNumber(0, allLinks.length - 1)];
            
            // Hover before clicking to simulate human behavior with timeout protection
            if (randomElement) {
                try {
                    await randomElement.hover({ timeout: 5000 });
                } catch (hoverError) {
                    this.bot.log(this.bot.isMobile, 'URL-REWARD', `Hover failed (likely overlay blocking): ${hoverError}`, 'warn');
                    //screenlog
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
                    const screenshotPath = `./url_rewards_hover_overlay_blocking_${timestamp}.png`;
                    await page.screenshot({ path: screenshotPath });
                    // Continue without hovering - just try mouse movement instead
                    // try to dismiss overlays again
                    await this.bot.browser.utils.tryDismissAllMessages(page);
                    try {
                        const box = await randomElement.boundingBox();
                        if (box) {
                            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                        }
                    } catch (mouseError) {
                        // Even mouse movement failed, skip to click or return
                        this.bot.log(this.bot.isMobile, 'URL-REWARD', 'Mouse movement also failed, skipping hover simulation', 'warn');
                        //screenlog
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
                        const screenshotPath = `./url_rewards_hover_mouse_movement_failed_${timestamp}.png`;
                        await page.screenshot({ path: screenshotPath });
                    }
                }
            }
            await this.bot.utils.wait(this.bot.utils.randomNumber(1000, 2000));
            
            // Cancel hover by moving mouse away
            await page.mouse.move(0, 0);
            
            // 30% probability for hover only, 70% for actual click
            const clickProbability = this.bot.utils.randomNumber(1, 100);
            if (clickProbability <= 30) {
                this.bot.log(this.bot.isMobile, 'URL-REWARD', `Performing hover-only and returning (probability: ${clickProbability}%)`);
                return;
            }

            if (randomElement) {
                await randomElement.click({ timeout: 2000 }).catch(() => { });
                this.bot.log(this.bot.isMobile, 'URL-REWARD', `Clicked on random element`);
            }

            // Handle potential popups
            await this.closeContinuePopup(page);

            // Stay for a random time to simulate reading/interaction
            const stayTime = this.bot.utils.randomNumber(3000, 8000);
            await this.bot.utils.wait(stayTime);

            // Get the current tab (might be new if link opened in new tab)
            const currentTab = await this.bot.browser.utils.getLatestTab(page);
            
            // If we're on a different page, go back
            if (currentTab !== page) {
                await this.closeTabs(currentTab);
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'URL-REWARD-CLICK', 'An error occurred:' + error, 'error');
            //screenlog
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
            const screenshotPath = `./url_rewards_error_occurred_${timestamp}.png`;
            await page.screenshot({ path: screenshotPath });
        }
    }

    /**
     * Close continue popup if it appears
     * @param page - Current page object
     */
    private async closeContinuePopup(page: Page) {
        try {
            await page.waitForSelector('#sacs_close', { timeout: 1000 });
            const continueButton = await page.$('#sacs_close');

            if (continueButton) {
                await continueButton.click();
            }
        } catch (error) {
            // Continue if element is not found or other error occurs
        }
    }

    /**
     * Manage tabs by closing extra ones
     * @param currentTab - Current tab reference
     */
    private async closeTabs(currentTab: Page) {
        const browser = currentTab.context();
        const tabs = browser.pages();

        try {
            if (tabs.length > 2) {
                // If more than 2 tabs are open, close the last tab
                await currentTab.close();
                this.bot.log(this.bot.isMobile, 'URL-REWARD-TABS', `More than 2 tabs were open, closed the last tab`);
            } else if (tabs.length === 1) {
                // If only 1 tab is open, this is normal for URL reward
                this.bot.log(this.bot.isMobile, 'URL-REWARD-TABS', 'Single tab remaining, this is expected for URL reward');
            }
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'URL-REWARD-TABS', 'An error occurred:' + error, 'error');
        }
    }

}
