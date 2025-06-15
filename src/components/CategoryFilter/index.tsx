import React, { useState } from 'react';
import './index.css';
import { 
  Utensils, 
  Coffee, 
  LandPlot, 
  Landmark, 
  ShoppingBag, 
  Building
} from 'lucide-react';

export interface CategoryOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

export interface CategoryFilterProps {
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  title?: string;
  multiple?: boolean;
  size?: 'sm' | 'md' | 'lg';
  defaultExpanded?: boolean;
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
  {
    id: 'food',
    label: 'Restaurants & Food',
    icon: <Utensils size={16} />,
    description: 'Restaurants, food places, dining'
  },
  {
    id: 'cafe',
    label: 'Cafes & Coffee',
    icon: <Coffee size={16} />,
    description: 'Coffee shops, cafes, dessert places'
  },
  {
    id: 'attraction',
    label: 'Museums & Attractions',
    icon: <Landmark size={16} />,
    description: 'Museums, galleries, tourist attractions'
  },
  {
    id: 'outdoor',
    label: 'Parks & Outdoor',
    icon: <LandPlot size={16} />,
    description: 'Parks, gardens, outdoor spaces'
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: <ShoppingBag size={16} />,
    description: 'Stores, malls, shopping centers'
  },
  {
    id: 'other',
    label: 'Other Places',
    icon: <Building size={16} />,
    description: 'Hotels, services, other establishments'
  }
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategories,
  onCategoryChange,
  title = "Filter by Categories",
  multiple = true,
  size = 'md',
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleCategoryClick = (categoryId: string) => {
    if (multiple) {
      if (selectedCategories.includes(categoryId)) {
        // Remove category
        onCategoryChange(selectedCategories.filter(id => id !== categoryId));
      } else {
        // Add category
        onCategoryChange([...selectedCategories, categoryId]);
      }
    } else {
      // Single selection
      if (selectedCategories.includes(categoryId)) {
        onCategoryChange([]); // Deselect if already selected
      } else {
        onCategoryChange([categoryId]);
      }
    }
  };

  const toggleAll = () => {
    if (selectedCategories.length === DEFAULT_CATEGORIES.length) {
      // Deselect all
      onCategoryChange([]);
    } else {
      // Select all
      onCategoryChange(DEFAULT_CATEGORIES.map(cat => cat.id));
    }
  };

  const getSelectedCategoryData = () => {
    return DEFAULT_CATEGORIES.filter(cat => selectedCategories.includes(cat.id));
  };

  return (
    <div className={`category-filter category-filter--${size}`}>
      <div className="category-filter__header">
        <div className="category-filter__header-main">
          <h4 className="category-filter__title">{title}</h4>
          <div className="category-filter__summary-compact">
            {selectedCategories.length === DEFAULT_CATEGORIES.length 
              ? "All categories selected" 
              : `${selectedCategories.length} of ${DEFAULT_CATEGORIES.length} selected`
            }
          </div>
        </div>
        <button 
          type="button"
          className="archived-expand-button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? "Collapse filter" : "Expand filter"}
        >
          <span className="archived-expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>
      </div>

      {!isExpanded && (
        <div className="category-filter__preview">
          {DEFAULT_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`category-filter__preview-item ${
                selectedCategories.includes(category.id) ? 'category-filter__preview-item--selected' : 'category-filter__preview-item--unselected'
              }`}
              onClick={() => handleCategoryClick(category.id)}
              title={`${selectedCategories.includes(category.id) ? 'Remove' : 'Add'} ${category.label}`}
            >
              <div className="category-filter__preview-icon">
                {category.icon}
              </div>
              <span className="category-filter__preview-label">{category.label}</span>
            </button>
          ))}
        </div>
      )}
      
      {isExpanded && (
        <div className="category-filter__expanded-content">
          <div className="category-filter__actions">
            {multiple && (
              <button 
                type="button"
                className="category-filter__toggle-all"
                onClick={toggleAll}
              >
                {selectedCategories.length === DEFAULT_CATEGORIES.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          
          <div className="category-filter__grid">
            {DEFAULT_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`category-filter__option ${
                  selectedCategories.includes(category.id) ? 'category-filter__option--selected' : ''
                }`}
                onClick={() => handleCategoryClick(category.id)}
              >
                <div className="category-filter__option-icon">
                  {category.icon}
                </div>
                <div className="category-filter__option-content">
                  <span className="category-filter__option-label">{category.label}</span>
                  {category.description && (
                    <span className="category-filter__option-description">{category.description}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryFilter; 