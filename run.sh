git pull &&
npm install &&
npm run build &&
npm run test &&
npm run test:prisma && 
pm2 restart app 
#|| pm2 start "npm start" --name app

