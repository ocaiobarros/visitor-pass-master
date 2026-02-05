import { useState } from 'react';
import { Shield } from 'lucide-react';
import { branding } from '@/config/branding';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
  iconClassName?: string;
  nameClassName?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-20 h-20',
};

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-10 h-10',
};

const BrandLogo = ({ 
  size = 'md', 
  showName = true, 
  className,
  iconClassName,
  nameClassName,
}: BrandLogoProps) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {branding.useLogo && !imageError ? (
        <img
          src={branding.logoPath}
          alt={branding.name}
          className={cn(sizeClasses[size], 'object-contain')}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={cn(
          sizeClasses[size],
          'rounded-lg bg-primary flex items-center justify-center',
          iconClassName
        )}>
          <Shield className={cn(iconSizeClasses[size], 'text-primary-foreground')} />
        </div>
      )}
      
      {showName && (
        <div className={nameClassName}>
          <h1 className="font-bold text-lg leading-tight">{branding.name}</h1>
          <p className="text-xs opacity-70">{branding.tagline}</p>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
