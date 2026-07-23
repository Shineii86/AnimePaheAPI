const axios = require('axios');

const BASE = process.env.API_URL || 'http://localhost:3000/api';

const tests = [
  { name: 'Health', url: '/health' },
  { name: 'Home', url: '/' },
  { name: 'Search', url: '/search?query=naruto' },
  { name: 'Suggestions', url: '/suggestions?query=one+piece' },
  { name: 'Trending', url: '/trending' },
  { name: 'Popular', url: '/popular' },
  { name: 'Recent', url: '/recent' },
  { name: 'Series', url: '/series' },
  { name: 'AZ List', url: '/az-list' },
  { name: 'Season', url: '/season' },
  { name: 'Genres', url: '/genres' },
  { name: 'Stats', url: '/stats' },
];

async function runTests() {
  console.log(`Testing API at ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const start = Date.now();
      const resp = await axios.get(`${BASE}${test.url}`, { timeout: 15000 });
      const duration = Date.now() - start;
      const success = resp.data.success === true;
      const count = Array.isArray(resp.data.results)
        ? resp.data.results.length
        : typeof resp.data.results === 'object'
          ? Object.keys(resp.data.results).length
          : 0;

      if (success) {
        console.log(`PASS  ${test.name.padEnd(20)} ${duration}ms  ${count} fields`);
        passed++;
      } else {
        console.log(`FAIL  ${test.name.padEnd(20)} ${duration}ms  success=false`);
        failed++;
      }
    } catch (err) {
      console.log(`ERROR ${test.name.padEnd(20)} ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
