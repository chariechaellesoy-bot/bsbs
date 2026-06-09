# BSBS API Deployment (CyberPanel / AlmaLinux 9)

1. SSH into the server.
2. Create backend directory:
   ```bash
   mkdir /home/badminton.blacksheepph.com/api
   ```
3. Upload or git clone the `server/` contents into:
   `/home/badminton.blacksheepph.com/api`
4. Install dependencies:
   ```bash
   cd /home/badminton.blacksheepph.com/api && npm install
   ```
5. Create `.env` from `.env.example` and fill real values.
6. Run `server/schema.sql` in CyberPanel → phpMyAdmin on database `badm_bs`.
7. Start API with PM2:
   ```bash
   pm2 start server.js --name bsbs-api && pm2 save
   ```
8. Create `/home/badminton.blacksheepph.com/public_html/.htaccess`:
   ```apache
   RewriteEngine On

   # Proxy /api/* to Express on port 3000
   RewriteCond %{REQUEST_URI} ^/api/
   RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]

   # SPA fallback — serve index.html for all non-file routes
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^ /index.html [L]
   ```
9. Upload frontend files to `/home/badminton.blacksheepph.com/public_html/`.
10. Enable SSL in CyberPanel → Websites → Manage → SSL → Issue SSL.
11. Create first admin account via `POST /api/auth/register` with role `admin`.
