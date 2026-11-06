/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand tokens taken from the Basil Media design (logo blue + white).
        basil: {
          DEFAULT: '#0F6EC2',
          deep: '#0A2F5C',
          night: '#061E3D',
          ice: '#EAF3FC',
          mist: '#F5F9FE',
          sky: '#7CC0F5',
          soft: '#5FA9EC',
          bright: '#2B86DA',
          line: '#DCE8F5',
          edge: '#CFE0F3',
          ink: '#0B1B33',
          muted: '#4A5D78',
          haze: '#BFDDF8',
          frost: '#D6E8FA',
        },
        gold: '#C9A84C',
        // Second brand accent: warm "sun" gold, used sparingly for highlights and live moments.
        sun: { DEFAULT: '#F5B942', soft: '#FDE7B0', deep: '#B7791F' },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 16px 36px rgba(10,47,92,0.16)',
        glow: '0 14px 30px rgba(15,110,194,0.35)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'marquee-reverse': { from: { transform: 'translateX(-50%)' }, to: { transform: 'translateX(0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        glow: { '0%,100%': { opacity: '.5', transform: 'scale(1)' }, '50%': { opacity: '.9', transform: 'scale(1.08)' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(15,110,194,0.5)' }, '100%': { boxShadow: '0 0 0 34px rgba(15,110,194,0)' } },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'marquee-reverse': 'marquee-reverse 46s linear infinite',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 7s ease-in-out infinite',
        pulseRing: 'pulseRing 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
