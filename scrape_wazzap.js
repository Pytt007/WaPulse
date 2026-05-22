const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Ensure puppeteer is installed
try {
  require.resolve('puppeteer');
  console.log('Puppeteer is already installed.');
} catch (e) {
  console.log('Puppeteer is not installed. Installing it now...');
  try {
    execSync('npm install puppeteer --no-save', { stdio: 'inherit' });
    console.log('Puppeteer installed successfully.');
  } catch (err) {
    console.error('Failed to install puppeteer automatically:', err.message);
    console.log('Please run: npm install puppeteer --no-save manually, then run this script again.');
    process.exit(1);
  }
}

const puppeteer = require('puppeteer');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const outputDir = path.join(__dirname, 'wazzap_scrape_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true, // Headless mode (runs in background). Set to false to see the browser window.
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log('Navigating to login page...');
    await page.goto('https://wazzap.ai/fr/login', { waitUntil: 'networkidle2' });

    // Wait for the login screen to load
    console.log('Waiting for login form to load...');
    await delay(5000); // Wait for client-side rendering
    await page.screenshot({ path: path.join(outputDir, '0_login_page_loaded.png') });

    // First, check if we need to click "Continuer avec Email"
    console.log('Checking for login buttons...');
    const buttons = await page.$$('button');
    let emailBtn = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text && text.includes('Continuer avec Email')) {
        emailBtn = btn;
        break;
      }
    }
    if (emailBtn) {
      console.log('Found "Continuer avec Email" button. Clicking it...');
      await emailBtn.click();
      await delay(3000); // Wait for animation
      await page.screenshot({ path: path.join(outputDir, '0_5_email_clicked.png') });
    }

    // Look for form input elements
    const emailSelector = 'input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="adresse" i]';
    const passwordSelector = 'input[type="password"], input[name="password"], input[placeholder*="mot de passe" i]';
    
    await page.waitForSelector(emailSelector, { timeout: 10000 }).catch(() => null);
    
    const emailInput = await page.$(emailSelector);
    const passwordInput = await page.$(passwordSelector);

    if (!emailInput || !passwordInput) {
      console.log('Could not find standard email/password inputs directly.');
      console.log('This could be because the page uses an iframe or dynamic auth portal.');
      
      // Let's dump the HTML content to help debug
      const html = await page.content();
      fs.writeFileSync(path.join(outputDir, 'login_page_debug.html'), html);
      console.log('Saved login_page_debug.html for inspection.');
      throw new Error('Email or password inputs not found. Please review login_page_debug.html and 0_login_page_loaded.png.');
    }

    console.log('Entering credentials...');
    await page.type(emailSelector, 'cyborgaagence@gmail.com');
    await page.type(passwordSelector, 'Bayaldi7');
    await page.screenshot({ path: path.join(outputDir, '1_credentials_entered.png') });

    console.log('Submitting login form...');
    const submitSelector = 'button[type="submit"], form button, button';
    const submitBtn = await page.$(submitSelector);
    if (submitBtn) {
      await Promise.all([
        page.click(submitSelector),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null)
      ]);
    } else {
      console.log('Submit button not found, pressing Enter...');
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
    }

    console.log('Taking screenshot after login attempt...');
    await delay(8000); // Wait for redirects
    await page.screenshot({ path: path.join(outputDir, '2_after_login_attempt.png') });
    
    const currentUrl = page.url();
    console.log('Current URL is:', currentUrl);

    // Save post-login html
    const postLoginHtml = await page.content();
    fs.writeFileSync(path.join(outputDir, 'post_login.html'), postLoginHtml);
    console.log('Saved post_login.html.');

    // Try to find all navigation links
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      })).filter(l => l.href.includes(window.location.origin));
    });
    
    console.log(`Found ${links.length} navigation links on the post-login page.`);
    fs.writeFileSync(path.join(outputDir, 'links.json'), JSON.stringify(links, null, 2));

    // Visite standard routes
    const pathsToVisit = [
      '/dashboard',
      '/settings',
      '/workflows',
      '/integrations',
      '/inbox',
      '/campaigns',
      '/broadcasts'
    ];

    const visitedUrls = new Set([currentUrl]);
    const baseUrl = new URL(currentUrl).origin;

    for (const subPath of pathsToVisit) {
      const targetUrl = baseUrl + subPath;
      if (visitedUrls.has(targetUrl)) continue;
      visitedUrls.add(targetUrl);

      console.log(`Visiting ${subPath}...`);
      try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await delay(4000);
        
        const cleanName = subPath.replace(/\//g, '_');
        await page.screenshot({ path: path.join(outputDir, `page${cleanName}.png`), fullPage: true });
        
        const content = await page.content();
        fs.writeFileSync(path.join(outputDir, `page${cleanName}.html`), content);
      } catch (err) {
        console.log(`Could not load ${subPath}:`, err.message);
      }
    }

    // Try visiting other custom links found
    for (const link of links) {
      if (visitedUrls.has(link.href)) continue;
      if (link.href.includes('logout') || link.href.includes('signout')) continue;
      if (visitedUrls.size > 15) break; // Limit total requests to be polite

      visitedUrls.add(link.href);
      console.log(`Visiting link: ${link.text || 'Unnamed'} (${link.href})...`);
      try {
        await page.goto(link.href, { waitUntil: 'networkidle2', timeout: 15000 });
        await delay(4000);
        
        const urlObj = new URL(link.href);
        const cleanName = urlObj.pathname.replace(/\//g, '_') + '_' + urlObj.search.replace(/[^a-zA-Z0-9]/g, '_');
        await page.screenshot({ path: path.join(outputDir, `link_${cleanName}.png`), fullPage: true });
      } catch (err) {
        console.log(`Could not load link ${link.href}:`, err.message);
      }
    }

  } catch (error) {
    console.error('An error occurred:', error.message);
    await page.screenshot({ path: path.join(outputDir, 'error_state.png') });
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log(`\nDone! Scrape complete. All results are saved in the directory:\n${outputDir}`);
  }
})();
