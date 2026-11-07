/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#e9e8e3',
        surface: '#ffffff',
        'surface-muted': '#f7f7f5',
        ink: '#181817',
        'ink-soft': '#454542',
        muted: '#77766f',
        faint: '#73726b',
        line: '#e2e1db',
        'line-strong': '#d2d1ca',
        accent: {
          50: '#eef0ff',
          100: '#e0e3ff',
          200: '#c5caff',
          300: '#a1a8ff',
          400: '#7b81fb',
          500: '#5b5ce8',
          600: '#4a45d1',
          700: '#3d38ae',
        },
        amber: {
          50: '#fff8e7',
          100: '#ffefc7',
          400: '#f5b83d',
          500: '#e7a51a',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        page: '0 1px 2px rgba(20, 19, 16, 0.08), 0 18px 42px -18px rgba(20, 19, 16, 0.28)',
        panel: '0 1px 2px rgba(20, 19, 16, 0.04), 0 12px 32px -20px rgba(20, 19, 16, 0.25)',
        float: '0 16px 48px -12px rgba(20, 19, 16, 0.32)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'scale-in': 'scale-in 140ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
