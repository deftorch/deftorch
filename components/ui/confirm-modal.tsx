'use client';

import React from 'react';
import { AlertTriangle, Trash2, Edit2, Info } from 'lucide-react';
import { Modal, ModalHeader, ModalContent } from './modal';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: 'delete' | 'edit' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon = 'warning',
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (icon) {
      case 'delete':
        return <Trash2 className="h-6 w-6" />;
      case 'edit':
        return <Edit2 className="h-6 w-6" />;
      case 'info':
        return <Info className="h-6 w-6" />;
      default:
        return <AlertTriangle className="h-6 w-6" />;
    }
  };

  const getColorClasses = () => {
    switch (variant) {
      case 'danger':
        return 'text-destructive bg-destructive/10';
      case 'warning':
        return 'text-amber-600 bg-amber-600/10 dark:text-amber-400';
      case 'info':
        return 'text-primary bg-primary/10';
      default:
        return 'text-destructive bg-destructive/10';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>{title}</ModalHeader>
      <ModalContent>
        <div className="flex flex-col items-center text-center py-4">
          {/* Icon */}
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center mb-4',
            getColorClasses()
          )}>
            {getIcon()}
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {cancelText}
            </Button>
            <Button
              variant={variant === 'danger' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              className="flex-1"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
};
