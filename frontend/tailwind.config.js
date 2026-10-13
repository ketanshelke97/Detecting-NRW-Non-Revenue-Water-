/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        scada: {
          bg: '#0B101A',      // Very dark industrial blue-black
          panel: '#151D2A',   // Slightly lighter for cards/panels
          border: '#233044',  // Panel borders
          accent: '#0EA5E9',  // Primary accent (cyan/blue)
          success: '#10B981', // Green for normal state
          warning: '#F59E0B', // Amber for warnings
          danger: '#EF4444',  // Red for critical
        }
      }
    },
  },
  plugins: [],
}

