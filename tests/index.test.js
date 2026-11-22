const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { getExtensionId } = require('./utils.test.js');

const EXTENSION_PATH = path.join(__dirname, '../src/');
const TEST_PROFILE_PATH = path.join(__dirname, '../dist', `puppeteer-test-${process.pid}`);

let browser;
let extensionId;

// --- Before Each Test ---
beforeEach(async () => {
    fs.mkdirSync(path.dirname(TEST_PROFILE_PATH), { recursive: true });
    browser = await puppeteer.launch({
        headless: 'new',
        pipe: true,
        enableExtensions: [EXTENSION_PATH],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        userDataDir: TEST_PROFILE_PATH,
        args: process.env.PUPPETEER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []
    });

    extensionId = await getExtensionId(browser);

    console.log(`Dynamically loaded extension ID: ${extensionId}`);
}, 30000);

afterEach(async () => {
    if (browser) {
        await browser.close();
    }
    browser = undefined;
}, 30000);

// --- The Test Case ---
test('popup renders correctly', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel/index.html`, { waitUntil: 'domcontentloaded' });

    const linkContainer = await page.$('div.title');
    expect(linkContainer).not.toBeNull();
}, 30000);
