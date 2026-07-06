import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t bg-card/50 backdrop-blur-sm py-6 mt-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Конфиденциальность
            </Link>
            <Link to="/rules" className="hover:text-foreground transition-colors">
              Правила
            </Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
            <Link to="/members" className="hover:text-foreground transition-colors">
              Участники
            </Link>
            <Link to="/brands/all" className="hover:text-foreground transition-colors">
              Бренды
            </Link>
            <Link to="/brands/rating" className="hover:text-foreground transition-colors font-medium text-yellow-500">
              🏆 Рейтинг брендов
            </Link>
            <Link to="/codeforum" className="hover:text-foreground transition-colors">
              Code Forum
            </Link>
            <Link
              to="/flexdev"
              className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 via-purple-400 to-cyan-400 hover:opacity-80 transition-opacity"
            >
              FlexDev
            </Link>
            <a
              href="https://voracious-connect-world-now.base44.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors font-medium text-purple-500 dark:text-purple-400"
            >
              Мессенджер ProHub x OinkGram
            </a>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
            <a
              href="https://freesoft.ru/gink-platforms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Made by Oink Platforms
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
