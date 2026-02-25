Sync progress uses Cloudflare Worker + KV.

Configured API base URL:
https://progress-api.maiquan2103.workers.dev

How it works:
1. User logs in with account id.
2. App reads/writes progress to:
   https://progress-api.maiquan2103.workers.dev/api/progress
3. Phone and desktop sync when using the same account.

Frontend script order in index.html:
1. constants.js
2. app.main.js
3. app.pmp.js
4. app.bjt.js
5. app.quiz.js
6. app.boot.js
