import { Page } from 'rebrowser-playwright'

import { Workers } from '../Workers'


export class Quiz extends Workers {

    async doQuiz(page: Page) {
        this.bot.log(this.bot.isMobile, 'QUIZ', 'Trying to complete quiz')

        try {
            // Check if the quiz has been started or not
            const quizNotStarted = await page.waitForSelector('#rqStartQuiz', { state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
            if (quizNotStarted) {
                await page.click('#rqStartQuiz')
            } else {
                this.bot.log(this.bot.isMobile, 'QUIZ', 'Quiz has already been started, trying to finish it')
            }

            await this.bot.utils.wait(2000)

            let quizData = await this.bot.browser.func.getQuizData(page)
            let questionsRemaining = quizData.maxQuestions - quizData.CorrectlyAnsweredQuestionCount // Amount of questions remaining

            // All questions - Dynamic loop that checks completion status
            while (questionsRemaining > 0) {
                // Check if quiz is already completed before proceeding
                const isCompleted = await this.bot.browser.func.checkQuizCompleted(page)
                if (isCompleted) {
                    this.bot.log(this.bot.isMobile, 'QUIZ', 'Quiz already completed, breaking loop')
                    break
                }

                // Always refresh quiz data before each question to get current state
                quizData = await this.bot.browser.func.getQuizData(page)
                questionsRemaining = quizData.maxQuestions - quizData.CorrectlyAnsweredQuestionCount

                // If no questions remaining, break
                if (questionsRemaining === 0) {
                    this.bot.log(this.bot.isMobile, 'QUIZ', 'All questions answered according to quiz data')
                    break
                }

                if (quizData.numberOfOptions === 8) {
                    const answers: string[] = []

                    for (let i = 0; i < quizData.numberOfOptions; i++) {
                        const answerSelector = await page.waitForSelector(`#rqAnswerOption${i}`, { state: 'visible', timeout: 10000 })
                        const answerAttribute = await answerSelector?.evaluate((el: any) => el.getAttribute('iscorrectoption'))

                        if (answerAttribute && answerAttribute.toLowerCase() === 'true') {
                            answers.push(`#rqAnswerOption${i}`)
                        }
                    }

                    // Click the answers
                    for (const answer of answers) {
                        await page.waitForSelector(answer, { state: 'visible', timeout: 2000 })

                        // Click the answer on page
                        await page.click(answer)

                        const refreshSuccess = await this.bot.browser.func.waitForQuizRefresh(page)
                        if (!refreshSuccess) {
                            await page.close()
                            this.bot.log(this.bot.isMobile, 'QUIZ', 'An error occurred, refresh was unsuccessful', 'error')
                            return
                        }
                    }

                    // Other type quiz, lightspeed
                } else if ([2, 3, 4].includes(quizData.numberOfOptions)) {
                    const correctOption = quizData.correctAnswer

                    for (let i = 0; i < quizData.numberOfOptions; i++) {
                        const answerSelector = await page.waitForSelector(`#rqAnswerOption${i}`, { state: 'visible', timeout: 10000 })
                        const dataOption = await answerSelector?.evaluate((el: any) => el.getAttribute('data-option'))

                        if (dataOption === correctOption) {
                            // Click the answer on page
                            await page.click(`#rqAnswerOption${i}`)

                            const refreshSuccess = await this.bot.browser.func.waitForQuizRefresh(page)
                            if (!refreshSuccess) {
                                await page.close()
                                this.bot.log(this.bot.isMobile, 'QUIZ', 'An error occurred, refresh was unsuccessful', 'error')
                                return
                            }
                        }
                    }
                    await this.bot.utils.wait(2000)
                }
            }

            // Final check to ensure quiz completion
            await this.bot.utils.wait(2000)
            const finalCheck = await this.bot.browser.func.checkQuizCompleted(page)
            if (finalCheck) {
                this.bot.log(this.bot.isMobile, 'QUIZ', 'Quiz completion confirmed')
            } else {
                this.bot.log(this.bot.isMobile, 'QUIZ', 'Quiz completion status unclear, but process finished', 'warn')
            }

            // Done with
            await this.bot.utils.wait(2000)
            await page.close()

            this.bot.log(this.bot.isMobile, 'QUIZ', 'Completed the quiz successfully')
        } catch (error) {
            await page.close()
            this.bot.log(this.bot.isMobile, 'QUIZ', 'An error occurred:' + error, 'error')
        }
    }

}