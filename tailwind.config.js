/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0A0B', soft: '#1A1A1C', line: '#2A2A2E' },
        ivory: { DEFAULT: '#F4F1EB', deep: '#EAE5DB', soft: '#FAF8F3' },
        acid: { DEFAULT: '#D4FF3A', deep: '#B8E02E', glow: '#E8FF6B' },
        mute: { DEFAULT: '#6B6B70', soft: '#9A9A9F' },
        yt: { red: '#FF0033' },
        ig: { p: '#833AB4', pink: '#E1306C', orange: '#F77737' },
        fb: { blue: '#1877F2' }
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      letterSpacing: { tightest: '-0.04em' }
    }
  },
  plugins: []
}
