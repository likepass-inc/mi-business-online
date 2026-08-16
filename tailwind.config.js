/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#ff322d',
          hover: '#e42622',
        },
        ink: '#111111',
        muted: '#666666',
        line: '#e5e5e5',
        danger: '#b00020',
      },
      fontFamily: {
        sans: [
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      maxWidth: {
        wrap: '1120px',
      },
      borderRadius: {
        admin: '2px',
      },
    },
  },
  plugins: [],
}
