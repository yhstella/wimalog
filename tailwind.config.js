/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F0F9F4',
          100: '#DCF0E3',
          200: '#B6E1C5',
          300: '#86CC9F',
          400: '#54B377',
          500: '#2E9A58',
          600: '#1E7C44',
          700: '#176237',
          800: '#13502E',
          900: '#0E3D23',
        },
        // 완전한 slate 스케일 — 이전엔 100/300/500/700/900만 정의돼 ink-200/400/600/800/50
        //   111곳이 어긋났음(border 기본색 폴백·text 미적용). 스케일 완성으로 의도된 톤 일관 적용.
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)',
        cardHover: '0 2px 4px rgba(15,23,42,0.06), 0 12px 24px rgba(15,23,42,0.08)',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseGentle: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        celebrate: {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(1.1)' },
          '60%':  { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        slideUp:     'slideUp 0.25s ease-out',
        slideDown:   'slideDown 0.2s ease-out',
        fadeIn:      'fadeIn 0.3s ease-out',
        pulseGentle: 'pulseGentle 2s ease-in-out infinite',
        celebrate:   'celebrate 0.5s ease-out',
      },
    },
  },
  plugins: [],
}
