const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: false,
    container: false,
  },
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{jsx,tsx,html,mdx}',
    './components/**/*',
    './docs/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', ...fontFamily.sans],
        jakarta: ['"Plus Jakarta Sans"', ...fontFamily.sans],
        mono: ['"Fira Code"', ...fontFamily.mono],
      },
      borderRadius: {
        sm: '4px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      screens: {
        sm: '0px',
        lg: '997px',
      },
      colors: {
        // Theme-aware colors using CSS variables
        background: {
          'transparent-black': 'var(--rf-glassmorphism-bg)',
          'transparent-black-secondary': 'var(--rf-glassmorphism-bg-hover)',
          'transparent-black-secondaryAlt': 'var(--rf-controls-bg)',
          'transparent-white-hover': 'var(--rf-controls-bg-hover)',
          'transparent-white-secondaryHover': 'var(--rf-glassmorphism-bg-hover)',
          'opaque-white': 'rgba(255, 255, 255, 1)',
          'disabled-light': 'rgba(100, 100, 100, 0.3)',
        },
        text: {
          light: 'var(--rf-text)',
          dark: 'var(--rf-text)',
        },
        icon: {
          'light-secondary': 'var(--rf-text-tertiary)',
        },
        border: {
          transparent: 'var(--rf-glassmorphism-border)',
        },
        // shadcn/ui theme colors using CSS variables
        'border-default': 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        'background-default': 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      backdropBlur: {
        lg: '40px',
      },
      boxShadow: {
        glassmorphic:
          '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        '3d': '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        spring: 'spring 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      keyframes: {
        spring: {
          '0%': { transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Custom plugin for glassmorphism utilities
    function ({ addUtilities }) {
      const newUtilities = {
        '.f-effect-backdrop-blur-lg': {
          backdropFilter: 'blur(40px)',
          '-webkit-backdrop-filter': 'blur(40px)',
        },
        '.f-effect-shadow-md': {
          boxShadow:
            '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        },
        '.border-3d': {
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow:
            '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        '.glass-morphism': {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
