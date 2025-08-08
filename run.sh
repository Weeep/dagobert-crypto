git pull &&
npm install &&
npm run build &&
pm2 restart app || pm2 start "npm start" --name app
