import ms from 'ms'

export default class Util {

    async wait(ms: number): Promise<void> {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    async waitRandom(min_ms: number, max_ms: number, distribution: 'uniform' | 'normal' = 'uniform'): Promise<void> {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, this.randomNumber(min_ms, max_ms, distribution))
        })
    }

    getFormattedDate(ms = Date.now()): string {
        const today = new Date(ms)
        const month = String(today.getMonth() + 1).padStart(2, '0')  // January is 0
        const day = String(today.getDate()).padStart(2, '0')
        const year = today.getFullYear()

        return `${month}/${day}/${year}`
    }

    shuffleArray<T>(array: T[]): T[] {
        return array.map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value)
    }

    randomNumber(min: number, max: number, distribution: 'uniform' | 'normal' = 'uniform'): number {
        if (distribution === 'uniform') {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        // Normal distribution implementation (Box-Muller transform)
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        num = num / 10.0 + 0.5; // normalize to 0-1 range
        if (num > 1 || num < 0) num = this.randomNumber(min, max, distribution); // boundary handling
        return Math.floor(num * (max - min + 1)) + min;
    }

    chunkArray<T>(arr: T[], numChunks: number): T[][] {
        const chunkSize = Math.ceil(arr.length / numChunks)
        const chunks: T[][] = []

        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize)
            chunks.push(chunk)
        }

        return chunks
    }

    stringToMs(input: string | number): number {
        const milisec = ms(input.toString())
        if (!milisec) {
            throw new Error('The string provided cannot be parsed to a valid time! Use a format like "1 min", "1m" or "1 minutes"')
        }
        return milisec
    }

}