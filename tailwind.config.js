/** Banner brand tokens — see BRAND_GUIDE.md (from the 2026 client deck).
 *  Coral is the ONE primary accent; navy is the dark neutral; green = positive money only. */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          50: '#FDECE9', 100: '#FBD5CE', 200: '#F7B3A6', 300: '#F2907D',
          400: '#F06E55', 500: '#EE5340', 600: '#E23F2B', 700: '#BE3423',
          800: '#9A2C1F', 900: '#7C271D', DEFAULT: '#EE5340',
        },
        navy: { DEFAULT: '#16202E', soft: '#1F2A3A', deep: '#0F1722' },
        ink: '#1F2A37',
        canvas: '#E9EEEF',
        hairline: '#ECEEF1',
        success: '#2FBF71',
        info: '#3B82F6',
        danger: '#DC3545',
      },
      fontFamily: {
        display: ['Poppins', 'Sofia Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '20px', image: '24px' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.5s infinite' },
    },
  },
  plugins: [],
}
