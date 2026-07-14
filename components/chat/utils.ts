import {
  PieChart,
  Network,
  BarChart3,
  Clock,
  GitFork,
  Shapes,
  Play,
  Code,
  Film,
  Image as ImageIcon,
  Layout,
  Sparkles,
  Wand2,
  Gamepad2,
  Zap,
  Globe,
  ClipboardList,
} from 'lucide-react';
import { RendererType } from '@/types';

export const getRelativeTimeString = (dateInput: Date | string) => {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const getCategoryInfo = (renderer: RendererType, code: string = '', title: string = '') => {
  const t = title.toLowerCase();
  const c = code.toLowerCase();
  const r = renderer || 'p5';

  if (r === 'd3') {
    if (t.includes('pie') || c.includes('d3.arc') || c.includes('pie')) {
      return {
        name: 'Pie Chart',
        icon: PieChart,
        colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
      };
    }
    if (t.includes('network') || t.includes('graph') || c.includes('forcesimulation') || c.includes('link')) {
      return {
        name: 'Network',
        icon: Network,
        colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
      };
    }
    return {
      name: 'Bar Chart',
      icon: BarChart3,
      colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    };
  }

  if (r === 'mermaid') {
    if (t.includes('sequence') || c.includes('sequencediagram')) {
      return {
        name: 'Sequence',
        icon: Clock,
        colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
      };
    }
    return {
      name: 'Flowchart',
      icon: Network,
      colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    };
  }

  if (r === 'svg') {
    if (t.includes('diagram') || t.includes('flow') || t.includes('chart')) {
      return {
        name: 'Diagram',
        icon: GitFork,
        colorClass: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
      };
    }
    return {
      name: 'Logo',
      icon: Shapes,
      colorClass: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
    };
  }

  if (r === 'twojs') {
    if (t.includes('motion') || t.includes('animation') || t.includes('kinetic')) {
      return {
        name: 'Motion Graphic',
        icon: Film,
        colorClass: 'bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
      };
    }
    return {
      name: 'Two.js Canvas',
      icon: Shapes,
      colorClass: 'bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
    };
  }

  if (r === 'mojs') {
    if (t.includes('burst') || t.includes('explosion') || t.includes('particle')) {
      return {
        name: 'Mo.js Particles',
        icon: Sparkles,
        colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
      };
    }
    return {
      name: 'Mo.js Motion',
      icon: Wand2,
      colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
    };
  }

  if (r === 'pixi') {
    if (t.includes('game') || t.includes('sprite') || t.includes('play')) {
      return {
        name: 'PixiJS Game',
        icon: Gamepad2,
        colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
      };
    }
    return {
      name: 'PixiJS Canvas',
      icon: ImageIcon,
      colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    };
  }

  if (r === 'gsap') {
    return {
      name: 'GSAP Animation',
      icon: Zap,
      colorClass: 'bg-lime-100 text-lime-700 dark:bg-lime-500/10 dark:text-lime-400',
    };
  }

  if (r === 'anime') {
    return {
      name: 'Anime.js',
      icon: Film,
      colorClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    };
  }

  if (r === 'lottie') {
    return {
      name: 'Lottie Animation',
      icon: Play,
      colorClass: 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
    };
  }

  if (r === 'matter') {
    return {
      name: 'Matter.js Physics',
      icon: Shapes,
      colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    };
  }

  if (r === 'html') {
    return {
      name: 'Web / HTML Canvas',
      icon: Globe,
      colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400',
    };
  }

  if (r === 'remotion') {
    return {
      name: 'Remotion Video',
      icon: Film,
      colorClass: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    };
  }

  if (r === 'plan') {
    return {
      name: 'Implementation Plan',
      icon: ClipboardList,
      colorClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
    };
  }

  if (t.includes('game') || t.includes('play') || t.includes('interactive') || c.includes('keypressed') || c.includes('mouseclicked') || c.includes('game')) {
    return {
      name: 'Game',
      icon: Play,
      colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    };
  }
  if (t.includes('pattern') || t.includes('wave') || t.includes('grid') || t.includes('gradient') || c.includes('sin(') || c.includes('cos(')) {
    return {
      name: 'Pattern',
      icon: Code,
      colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    };
  }
  if (t.includes('animation') || t.includes('bouncing') || t.includes('particle') || c.includes('framecount') || c.includes('framerate')) {
    return {
      name: 'Animation',
      icon: Film,
      colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    };
  }
  if (t.includes('art') || t.includes('fractal') || t.includes('generative') || c.includes('random') || c.includes('noise')) {
    return {
      name: 'Art',
      icon: ImageIcon,
      colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    };
  }

  return {
    name: 'Canvas',
    icon: Layout,
    colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  };
};
