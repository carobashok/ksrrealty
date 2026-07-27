@echo off
REM Run this from inside your ksr-mis folder
REM It creates all required folders and stub files

mkdir src\pages 2>nul
mkdir src\components 2>nul
mkdir src\lib 2>nul

REM Create stub pages
for %%P in (Dashboard Projects ProjectDetail Customers Bookings BookingDetail NewBooking Payments Employees) do (
  echo export default function %%P() { return ^<div className="p-6"^>^<h1 className="text-xl font-bold text-navy"^>%%P^</h1^>^<p className="text-gray-500 mt-1"^>Coming soon.^</p^>^</div^> } > src\pages\%%P.jsx
)

echo All stub pages created.
echo.
echo Now copy these downloaded files manually:
echo   App.jsx          -^> src\App.jsx
echo   main.jsx         -^> src\main.jsx
echo   index.css        -^> src\index.css
echo   supabase.js      -^> src\lib\supabase.js
echo   Layout.jsx       -^> src\components\Layout.jsx
echo   PlotInventory.jsx -^> src\pages\PlotInventory.jsx
echo   tailwind.config  -^> tailwind.config.js
echo.
echo Then create .env.local with your Supabase URL and anon key.
echo Then run: npm run dev
pause
