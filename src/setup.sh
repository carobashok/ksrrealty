# KSR Real Estate MIS — React App Setup
# Run these commands in your terminal

# 1. Create the React app
npm create vite@latest ksr-mis -- --template react
cd ksr-mis

# 2. Install dependencies
npm install
npm install @supabase/supabase-js
npm install react-router-dom
npm install @tanstack/react-query
npm install react-hot-toast
npm install lucide-react
npm install date-fns

# 3. Install dev dependencies
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Run the app
npm run dev
