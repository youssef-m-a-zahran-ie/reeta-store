import { dict, type Lang } from "../i18n";

export function waLink(number: string, text?: string) {
  const digits = number.replace(/[^\d]/g, "").replace(/^0/, "20");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function WhatsAppFloat({ lang, number }: { lang: Lang; number: string }) {
  return (
    <a
      href={waLink(number)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={dict[lang].whatsappFloat}
      className="fixed end-4 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-30 grid size-14 place-items-center rounded-full bg-sage text-white shadow-[0_10px_24px_-8px_rgb(58_36_32/.5)] transition-transform hover:scale-105 md:bottom-6"
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.7 2.6 4.1 3.6 1.5.7 2.1.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3Z" />
      </svg>
    </a>
  );
}
