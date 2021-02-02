import { ClientFunction, RequestLogger, t } from 'testcafe'
import fetch from 'node-fetch'

const captureLogger = RequestLogger(/ip=1/, {
    logRequestHeaders: true,
    logRequestBody: true,
    logResponseHeaders: true,
    logResponseBody: true,
    stringifyRequestBody: true,
})

const allNetwork = RequestLogger(/./, {
    logRequestHeaders: true,
    logRequestBody: true,
    logResponseHeaders: true,
    logResponseBody: true,
    stringifyRequestBody: true,
    stringifyResponseBody: true,
})

const initPosthog = ClientFunction(() => {
    const $win: any = window
    $win.posthog.init('e2e_token_1239', { api_host: 'http://localhost:8000' })
    console.log($win.posthog)
})

async function queryAPIOnce(): Promise<Array<{ event: string }>> {
    const response = await fetch('http://localhost:8000/api/event', {
        headers: { Authorization: 'Bearer e2e_demo_api_key' },
    })

    const { results } = JSON.parse(await response.text())
    return results
}

async function queryAPI(): Promise<Array<{ event: string }>> {
    const attempt = (count, resolve, reject) => {
        if (count === 50) {
            return reject(new Error('Failed to fetch results in 10 attempts'))
        }

        setTimeout(() => {
            queryAPIOnce()
                .then((results) => (results.length > 0 ? resolve(results) : attempt(count + 1, resolve, reject)))
                .catch(reject)
        }, 300)
    }

    return new Promise((...args) => attempt(0, ...args))
}

fixture('posthog.js capture')
    .page('http://localhost:8080/playground/cypress/index.html')
    .requestHooks(captureLogger, allNetwork)
    .afterEach(async () => {
        console.log(await t.getBrowserConsoleMessages())
        console.log(JSON.stringify(allNetwork, null, 2))
    })

test('Captured events are accessible via /api/event', async (t) => {
    await initPosthog()
    await t
        .click('[data-cy-custom-event-button]')
        .expect(captureLogger.count(() => true))
        .gt(1)

    const results = await queryAPI()

    console.log(results)

    await t.expect(results.length).gte(2)
    await t.expect(results.filter(({ event }) => event === 'custom-event').length).gte(1)
    await t.expect(results.filter(({ event }) => event === '$pageview').length).gte(1)
})
