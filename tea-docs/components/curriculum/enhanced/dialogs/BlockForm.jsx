/**
 * Block Form Component
 *
 * Dynamic form component that adapts based on node type.
 * Provides type-specific fields with validation and smart defaults.
 *
 * Features:
 * - Common fields: Name, Description
 * - Type-specific fields based on node type
 * - Form validation with error display
 * - Auto-save draft support
 * - Quick mode for minimal fields
 * - Character count for text areas
 * - Tag inputs for metadata
 * - Date pickers for deadlines
 * - Sliders for numeric values
 *
 * @component
 */

import React, { forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Slider } from '../../../ui/slider';
import { Badge } from '../../../ui/badge';
import { cn } from '../../../../lib/utils';
import { AlertCircle, Calendar, Tag, Upload } from 'lucide-react';

/**
 * Form Field Wrapper
 */
const FormField = ({ label, error, required, children, helperText }) => {
  return (
    <div className="space-y-2">
      <Label className="text-text-light text-sm font-medium">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      {children}
      {helperText && !error && (
        <p className="text-xs text-text-light/50">{helperText}</p>
      )}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs text-red-400"
        >
          <AlertCircle className="w-3 h-3" />
          {error}
        </motion.div>
      )}
    </div>
  );
};

/**
 * Character Counter Component
 */
const CharacterCounter = ({ current, max, className }) => {
  const percentage = (current / max) * 100;
  const isNearLimit = percentage > 80;
  const isOverLimit = current > max;

  return (
    <div className={cn('text-xs', className)}>
      <span
        className={cn(
          isOverLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-text-light/50'
        )}
      >
        {current} / {max}
      </span>
    </div>
  );
};

/**
 * Tag Input Component
 */
const TagInput = ({ value = [], onChange, placeholder, maxTags = 10 }) => {
  const [inputValue, setInputValue] = React.useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !value.includes(newTag) && value.length < maxTags) {
        onChange([...value, newTag]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="bg-background-transparent-white-hover text-text-light"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1.5 hover:text-red-400"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'bg-background-transparent-white-hover',
          'border-transparent',
          'text-text-light',
          'placeholder:text-text-light/50'
        )}
      />
      <p className="text-xs text-text-light/50">
        Press Enter or comma to add tags
      </p>
    </div>
  );
};

/**
 * BlockForm Component
 */
const BlockForm = forwardRef(
  ({ nodeType, formData = {}, onChange, quickMode = false, validationErrors = {} }, ref) => {
    // Expose validation method to parent
    useImperativeHandle(ref, () => ({
      validate: () => {
        const errors = {};
        if (!formData.name?.trim()) {
          errors.name = 'Name is required';
        }
        if (!formData.description?.trim() && !quickMode) {
          errors.description = 'Description is required';
        }
        return errors;
      },
      getData: () => formData,
    }));

    // Handle field change
    const handleChange = useCallback(
      (field, value) => {
        onChange({ ...formData, [field]: value });
      },
      [formData, onChange]
    );

    // Set default values based on node type
    useEffect(() => {
      if (Object.keys(formData).length === 0) {
        const defaults = getDefaultFormData(nodeType);
        onChange(defaults);
      }
    }, [nodeType]);

    // Common fields for all node types
    const renderCommonFields = () => (
      <>
        {/* Name */}
        <FormField
          label="Name"
          required
          error={validationErrors.name}
          helperText="A clear, concise name for this node"
        >
          <Input
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Enter node name..."
            maxLength={100}
            className={cn(
              'bg-background-transparent-white-hover',
              'border-transparent',
              'text-text-light',
              'placeholder:text-text-light/50'
            )}
          />
          <CharacterCounter current={formData.name?.length || 0} max={100} />
        </FormField>

        {/* Description */}
        {!quickMode && (
          <FormField
            label="Description"
            required
            error={validationErrors.description}
            helperText="Detailed description of this node's purpose"
          >
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter description..."
              rows={4}
              maxLength={500}
              className={cn(
                'bg-background-transparent-white-hover',
                'border-transparent',
                'text-text-light',
                'placeholder:text-text-light/50',
                'resize-none'
              )}
            />
            <CharacterCounter current={formData.description?.length || 0} max={500} />
          </FormField>
        )}
      </>
    );

    // Goal-specific fields
    const renderGoalFields = () => (
      <>
        {!quickMode && (
          <>
            <FormField
              label="Priority"
              helperText="Importance level of this goal"
            >
              <Select
                value={formData.priority || 'medium'}
                onValueChange={(value) => handleChange('priority', value)}
              >
                <SelectTrigger className="bg-background-transparent-white-hover border-transparent text-text-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Target Date"
              helperText="When this goal should be achieved"
            >
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light/50" />
                <Input
                  type="date"
                  value={formData.targetDate || ''}
                  onChange={(e) => handleChange('targetDate', e.target.value)}
                  className={cn(
                    'pl-10',
                    'bg-background-transparent-white-hover',
                    'border-transparent',
                    'text-text-light'
                  )}
                />
              </div>
            </FormField>

            <FormField
              label="Success Criteria"
              helperText="How will you measure success?"
            >
              <Textarea
                value={formData.successCriteria || ''}
                onChange={(e) => handleChange('successCriteria', e.target.value)}
                placeholder="Define success criteria..."
                rows={3}
                maxLength={300}
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50',
                  'resize-none'
                )}
              />
              <CharacterCounter current={formData.successCriteria?.length || 0} max={300} />
            </FormField>
          </>
        )}
      </>
    );

    // Strategy-specific fields
    const renderStrategyFields = () => (
      <>
        {!quickMode && (
          <>
            <FormField
              label="Strategy Type"
              helperText="How this strategy decomposes the parent goal"
            >
              <Select
                value={formData.strategyType || 'AND'}
                onValueChange={(value) => handleChange('strategyType', value)}
              >
                <SelectTrigger className="bg-background-transparent-white-hover border-transparent text-text-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND (All sub-goals required)</SelectItem>
                  <SelectItem value="OR">OR (Any sub-goal sufficient)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Approach"
              helperText="The decomposition approach being used"
            >
              <Input
                value={formData.approach || ''}
                onChange={(e) => handleChange('approach', e.target.value)}
                placeholder="e.g., 'By system component', 'By hazard type'..."
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50'
                )}
              />
            </FormField>

            <FormField
              label="Rationale"
              helperText="Why this strategy was chosen"
            >
              <Textarea
                value={formData.rationale || ''}
                onChange={(e) => handleChange('rationale', e.target.value)}
                placeholder="Explain the reasoning..."
                rows={3}
                maxLength={300}
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50',
                  'resize-none'
                )}
              />
              <CharacterCounter current={formData.rationale?.length || 0} max={300} />
            </FormField>
          </>
        )}
      </>
    );

    // Property Claim-specific fields
    const renderPropertyClaimFields = () => (
      <>
        {!quickMode && (
          <>
            <FormField
              label="Claim Text"
              helperText="The specific claim being made"
            >
              <Textarea
                value={formData.claimText || ''}
                onChange={(e) => handleChange('claimText', e.target.value)}
                placeholder="State the claim clearly..."
                rows={3}
                maxLength={400}
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50',
                  'resize-none'
                )}
              />
              <CharacterCounter current={formData.claimText?.length || 0} max={400} />
            </FormField>

            <FormField
              label="Strength"
              helperText="How strong is this claim?"
            >
              <div className="space-y-2">
                <Slider
                  value={[formData.strength || 50]}
                  onValueChange={(value) => handleChange('strength', value[0])}
                  max={100}
                  step={10}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-text-light/50">
                  <span>Weak</span>
                  <span className="text-text-light font-medium">{formData.strength || 50}%</span>
                  <span>Strong</span>
                </div>
              </div>
            </FormField>

            <FormField
              label="Verification Method"
              helperText="How will this claim be verified?"
            >
              <Select
                value={formData.verificationMethod || 'testing'}
                onValueChange={(value) => handleChange('verificationMethod', value)}
              >
                <SelectTrigger className="bg-background-transparent-white-hover border-transparent text-text-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="demonstration">Demonstration</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </>
        )}
      </>
    );

    // Evidence-specific fields
    const renderEvidenceFields = () => (
      <>
        {!quickMode && (
          <>
            <FormField
              label="Evidence Source"
              helperText="Where this evidence comes from"
            >
              <Input
                value={formData.source || ''}
                onChange={(e) => handleChange('source', e.target.value)}
                placeholder="e.g., 'Test Report TR-2024-001'..."
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50'
                )}
              />
            </FormField>

            <FormField
              label="Confidence Level"
              helperText="How confident are you in this evidence?"
            >
              <div className="space-y-2">
                <Slider
                  value={[formData.confidence || 75]}
                  onValueChange={(value) => handleChange('confidence', value[0])}
                  max={100}
                  step={5}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-text-light/50">
                  <span>Low</span>
                  <span className="text-text-light font-medium">{formData.confidence || 75}%</span>
                  <span>High</span>
                </div>
              </div>
            </FormField>

            <FormField
              label="Link/URL"
              helperText="Link to evidence document or artifact"
            >
              <Input
                type="url"
                value={formData.link || ''}
                onChange={(e) => handleChange('link', e.target.value)}
                placeholder="https://..."
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50'
                )}
              />
            </FormField>

            <FormField
              label="Tags"
              helperText="Add tags to categorize this evidence"
            >
              <TagInput
                value={formData.tags || []}
                onChange={(tags) => handleChange('tags', tags)}
                placeholder="Add tags..."
              />
            </FormField>
          </>
        )}
      </>
    );

    // Context-specific fields
    const renderContextFields = () => (
      <>
        {!quickMode && (
          <>
            <FormField
              label="Context Type"
              helperText="What kind of context is this?"
            >
              <Select
                value={formData.contextType || 'assumption'}
                onValueChange={(value) => handleChange('contextType', value)}
              >
                <SelectTrigger className="bg-background-transparent-white-hover border-transparent text-text-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assumption">Assumption</SelectItem>
                  <SelectItem value="justification">Justification</SelectItem>
                  <SelectItem value="constraint">Constraint</SelectItem>
                  <SelectItem value="definition">Definition</SelectItem>
                  <SelectItem value="scope">Scope</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Importance"
              helperText="How critical is this context?"
            >
              <Select
                value={formData.importance || 'medium'}
                onValueChange={(value) => handleChange('importance', value)}
              >
                <SelectTrigger className="bg-background-transparent-white-hover border-transparent text-text-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Validity Period"
              helperText="How long is this context valid?"
            >
              <Input
                value={formData.validityPeriod || ''}
                onChange={(e) => handleChange('validityPeriod', e.target.value)}
                placeholder="e.g., 'Duration of project', 'Until 2025'..."
                className={cn(
                  'bg-background-transparent-white-hover',
                  'border-transparent',
                  'text-text-light',
                  'placeholder:text-text-light/50'
                )}
              />
            </FormField>
          </>
        )}
      </>
    );

    return (
      <div className="space-y-4">
        {renderCommonFields()}

        {/* Type-specific fields */}
        {nodeType === 'goal' && renderGoalFields()}
        {nodeType === 'strategy' && renderStrategyFields()}
        {nodeType === 'propertyClaim' && renderPropertyClaimFields()}
        {nodeType === 'evidence' && renderEvidenceFields()}
        {nodeType === 'context' && renderContextFields()}
      </div>
    );
  }
);

BlockForm.displayName = 'BlockForm';

/**
 * Get default form data for node type
 */
const getDefaultFormData = (nodeType) => {
  const defaults = {
    goal: {
      name: '',
      description: '',
      priority: 'medium',
      targetDate: '',
      successCriteria: '',
    },
    strategy: {
      name: '',
      description: '',
      strategyType: 'AND',
      approach: '',
      rationale: '',
    },
    propertyClaim: {
      name: '',
      description: '',
      claimText: '',
      strength: 50,
      verificationMethod: 'testing',
    },
    evidence: {
      name: '',
      description: '',
      source: '',
      confidence: 75,
      link: '',
      tags: [],
    },
    context: {
      name: '',
      description: '',
      contextType: 'assumption',
      importance: 'medium',
      validityPeriod: '',
    },
  };

  return defaults[nodeType] || defaults.goal;
};

export default BlockForm;
