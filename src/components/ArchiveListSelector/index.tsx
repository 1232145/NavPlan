import React from 'react';
import { ArchivedList } from '../../types';
import { Button } from '../Button';
import {
  X,
  FolderOpen,
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import './index.css';

interface ArchiveListSelectorProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (list: ArchivedList) => void;
  availableLists: ArchivedList[];
  selectedList: ArchivedList | null;
  onSelectList: (list: ArchivedList) => void;
  loading?: boolean;
  error?: string | null;
}

const ArchiveListSelector: React.FC<ArchiveListSelectorProps> = ({
  open,
  onClose,
  onConfirm,
  availableLists,
  selectedList,
  onSelectList,
  loading = false,
  error = null
}) => {
  if (!open) return null;

  const handleConfirm = () => {
    if (selectedList) {
      onConfirm(selectedList);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAvailableSlots = (list: ArchivedList) => {
    return 3 - list.saved_schedules.length;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <FolderOpen size={20} style={{ marginRight: '12px' }} />
            Choose Archive List
          </h3>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="archive-list-selector-content">
          <p className="archive-list-selector-description">
            Select an archive list to save your current schedule to. Only lists with available slots are shown.
          </p>

          {/* Error State */}
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <Loader2 size={20} className="loading-spinner" />
              <span className="loading-text">Loading archive lists...</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && availableLists.length === 0 && (
            <div className="archive-list-selector-empty">
              <FolderOpen size={48} />
              <h4>No Available Lists</h4>
              <p>
                All your archive lists are full (3/3 schedules).
                Create a new list or delete some schedules to free up space.
              </p>
            </div>
          )}

          {/* Lists Grid */}
          {!loading && !error && availableLists.length > 0 && (
            <div className="archive-lists-grid">
              {availableLists.map(list => (
                <div
                  key={list.id}
                  className={`archive-list-option ${selectedList?.id === list.id ? 'selected' : ''}`}
                  onClick={() => onSelectList(list)}
                >
                  <div className="archive-list-option-header">
                    <div className="archive-list-option-icon">
                      <MapPin size={16} />
                    </div>
                    <div className="archive-list-option-info">
                      <h4 className="archive-list-option-name">{list.name}</h4>
                      <div className="archive-list-option-meta">
                        <span className="archive-list-option-date">
                          <Calendar size={12} />
                          {formatDate(list.date)}
                        </span>
                        <span className="archive-list-option-places">
                          {list.places.length} places
                        </span>
                      </div>
                    </div>
                    {selectedList?.id === list.id && (
                      <div className="archive-list-option-selected">
                        <CheckCircle size={20} />
                      </div>
                    )}
                  </div>

                  <div className="archive-list-option-slots">
                    <div className="slots-info">
                      <span className="slots-available">
                        {getAvailableSlots(list)} slot{getAvailableSlots(list) !== 1 ? 's' : ''} available
                      </span>
                      <div className="slots-visual">
                        {Array.from({ length: 3 }, (_, i) => (
                          <div
                            key={i}
                            className={`slot ${i < list.saved_schedules.length ? 'filled' : 'empty'}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {list.note && (
                    <div className="archive-list-option-note">
                      <span>"{list.note}"</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="archive-list-selector-footer">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            disabled={loading || !selectedList}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="loading-spinner small" />
                Saving...
              </>
            ) : (
              'Save to This List'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveListSelector; 