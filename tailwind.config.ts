import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./client/index.html', './client/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        blob: '30% 70% 70% 30% / 30% 30% 70% 70%',
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        nature: {
          ocean: { deep: '#0C4A6E', DEFAULT: '#0369A1', light: '#38BDF8', foam: '#BAE6FD', mist: '#F0F9FF' },
          forest: { deep: '#14532D', DEFAULT: '#15803D', light: '#4ADE80', sage: '#86EFAC', mist: '#F0FDF4' },
          sky: { lavender: '#A78BFA', violet: '#7C3AED' },
          aurora: { pink: '#F472B6', rose: '#FB7185' },
          sunrise: { amber: '#FBBF24', coral: '#FB923C' },
          earth: { warm: '#D4A574', sand: '#FEF3C7' },
        },
        brand: {
          red: '#E8541A',
          darkred: '#C43B0E',
          navy: '#1B2F6E',
          gold: '#F0A500',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset',
        'glass-hover': '0 16px 48px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.8) inset',
        nature: '0 4px 24px rgba(21,128,61,0.12)',
        'nature-lg': '0 12px 40px rgba(21,128,61,0.15)',
        'nature-glow': '0 0 30px rgba(74,222,128,0.15)',
        ocean: '0 4px 24px rgba(3,105,161,0.12)',
        aurora: '0 4px 24px rgba(167,139,250,0.12)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;
