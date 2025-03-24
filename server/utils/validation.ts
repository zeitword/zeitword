import { z, ZodSchema, ZodError } from "zod";
import { createError, H3Event } from "h3";

// Define types for field data
type FieldData = {
  fieldType: string;
  defaultValue: string | null;
  minValue: number | null;
  maxValue: number | null;
  [key: string]: unknown;
};

// Common parameter schemas that can be reused across the application
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid(),
  
  // String ID validation (non-empty)
  id: z.string().min(1),
  
  // Standard parameter schemas for routes
  siteId: z.string().uuid(),
  componentId: z.string().uuid(),
  fieldKey: z.string().min(1),
  organisationId: z.string().uuid()
};

// Field type enum for consistent validation
export const fieldTypeEnum = z.enum([
  "blocks",
  "text",
  "textarea",
  "richtext",
  "markdown",
  "number",
  "datetime",
  "boolean",
  "option",
  "options",
  "asset",
  "assets",
  "link",
  "section",
  "custom"
]);

// Option schema for reuse
export const optionSchema = z.object({
  id: z.string().uuid().optional(),
  optionName: z.string().min(1),
  optionValue: z.string().min(1)
});

// Shared base schema for field data
export const fieldBaseSchema = {
  fieldKey: z.string().min(1).max(255),
  fieldType: fieldTypeEnum,
  required: z.boolean(),
  description: z.string().max(255).nullable(),
  displayName: z.string().max(255).nullable(),
  defaultValue: z.string().max(255).nullable(),
  minValue: z.number().min(0).nullable(),
  maxValue: z.number().min(0).nullable(),
  componentWhitelist: z.array(z.string()).optional(),
};

// Create an options schema that extends the base
export const fieldWithOptionsSchema = z.object({
  ...fieldBaseSchema,
  options: z.array(optionSchema).optional()
});

// Field validation function using Zod refinements
export const createFieldValidationSchema = <T extends ZodSchema>(baseSchema: T) => {
  return baseSchema.superRefine((data: FieldData, ctx) => {
    // Min/max relationship validation
    if (data.minValue !== null && data.maxValue !== null && data.minValue > data.maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum value cannot be greater than maximum value",
        path: ["minValue"]
      });
      return;
    }

    // Text field validations
    if ((data.fieldType === "text" || data.fieldType === "textarea" || data.fieldType === "richtext" || data.fieldType === "markdown") && data.defaultValue) {
      // Min length validation
      if (data.minValue !== null && data.defaultValue.length < data.minValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: data.minValue,
          type: "string",
          inclusive: true,
          message: `Default value length must be at least ${data.minValue} characters`,
          path: ["defaultValue"]
        });
      }
      
      // Max length validation
      if (data.maxValue !== null && data.defaultValue.length > data.maxValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: data.maxValue,
          type: "string", 
          inclusive: true,
          message: `Default value length cannot exceed ${data.maxValue} characters`,
          path: ["defaultValue"]
        });
      }
    }

    // Number field validations
    if (data.fieldType === "number" && data.defaultValue !== null) {
      // Validate it's a valid number
      const numValue = Number(data.defaultValue);
      if (isNaN(numValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          expected: "number",
          received: "string",
          message: "Default value must be a valid number",
          path: ["defaultValue"]
        });
        return;
      }
      
      // Min value validation
      if (data.minValue !== null && numValue < data.minValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: data.minValue,
          type: "number",
          inclusive: true,
          message: `Default value must be at least ${data.minValue}`,
          path: ["defaultValue"]
        });
      }
      
      // Max value validation
      if (data.maxValue !== null && numValue > data.maxValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: data.maxValue,
          type: "number",
          inclusive: true,
          message: `Default value cannot exceed ${data.maxValue}`,
          path: ["defaultValue"]
        });
      }
    }
    
    // Array field validations (assets, blocks, options)
    if ((data.fieldType === "assets" || data.fieldType === "blocks" || data.fieldType === "options") && 
        data.defaultValue && data.defaultValue.trim() !== '') {
      try {
        const arrayValue = JSON.parse(data.defaultValue);
        
        if (Array.isArray(arrayValue)) {
          // Min items validation
          if (data.minValue !== null && arrayValue.length < data.minValue) {
            ctx.addIssue({
              code: z.ZodIssueCode.too_small,
              minimum: data.minValue,
              type: "array",
              inclusive: true,
              message: `Default value must contain at least ${data.minValue} items`,
              path: ["defaultValue"]
            });
          }
          
          // Max items validation
          if (data.maxValue !== null && arrayValue.length > data.maxValue) {
            ctx.addIssue({
              code: z.ZodIssueCode.too_big,
              maximum: data.maxValue,
              type: "array", 
              inclusive: true,
              message: `Default value cannot contain more than ${data.maxValue} items`,
              path: ["defaultValue"]
            });
          }
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Default value for array type must be a valid JSON array",
            path: ["defaultValue"]
          });
        }
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Default value for array type must be a valid JSON array",
          path: ["defaultValue"]
        });
      }
    }
  });
};

// Helper function to handle Zod validation errors consistently
export const validateField = async <T extends ZodSchema>(event: H3Event, schema: T) => {
  try {
    return await readValidatedBody(event, schema.parse);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw createError({
        statusCode: 400,
        statusMessage: firstIssue.message
      });
    }
    throw error;
  }
};

/**
 * Validates route parameters using Zod schemas
 * 
 * @param event - H3 event
 * @param paramSchemas - Object mapping parameter names to Zod schemas
 * @returns Object with validated parameters
 */
export const validateRouteParams = <T extends Record<string, ZodSchema>>(
  event: H3Event, 
  paramSchemas: T
): { [K in keyof T]: z.infer<T[K]> } => {
  const params: Record<string, unknown> = {};
  const errors: { param: string; message: string }[] = [];

  // Validate each parameter
  for (const [paramName, schema] of Object.entries(paramSchemas)) {
    const value = getRouterParam(event, paramName);
    
    try {
      params[paramName] = schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push({
          param: paramName,
          message: error.issues[0].message
        });
      }
    }
  }

  // If any validation errors, throw with first error
  if (errors.length > 0) {
    const { param, message } = errors[0];
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ${param}: ${message}`
    });
  }

  return params as { [K in keyof T]: z.infer<T[K]> };
};

/**
 * Validates query parameters using Zod schemas
 * 
 * @param event - H3 event
 * @param querySchemas - Object mapping parameter names to Zod schemas
 * @returns Object with validated parameters
 */
export const validateQueryParams = <T extends Record<string, ZodSchema>>(
  event: H3Event, 
  querySchemas: T
): { [K in keyof T]: z.infer<T[K]> } => {
  const query = getQuery(event);
  const params: Record<string, unknown> = {};
  const errors: { param: string; message: string }[] = [];

  // Validate each parameter
  for (const [paramName, schema] of Object.entries(querySchemas)) {
    const value = query[paramName];
    
    try {
      params[paramName] = schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push({
          param: paramName,
          message: error.issues[0].message
        });
      }
    }
  }

  // If any validation errors, throw with first error
  if (errors.length > 0) {
    const { param, message } = errors[0];
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid query parameter ${param}: ${message}`
    });
  }

  return params as { [K in keyof T]: z.infer<T[K]> };
};

// Field interface for collection validation
interface Field {
  minValue: number | null;
  maxValue: number | null;
}

// Common validation for field collections (blocks, assets)
export const validateFieldCollection = (field: Field, value: unknown[]) => {
  const errors: string[] = [];
  
  // Min items validation
  if (field.minValue !== null && value.length < field.minValue) {
    errors.push(`At least ${field.minValue} items required`);
  }
  
  // Max items validation
  if (field.maxValue !== null && value.length > field.maxValue) {
    errors.push(`Cannot exceed ${field.maxValue} items`);
  }
  
  return errors.length ? errors : null;
};

/**
 * Client-side field validation helpers
 * These can be used in frontend components
 */
export const clientValidation = {
  /**
   * Validates text input against min/max constraints
   * @param value Text value to validate
   * @param field Field configuration with min/max values
   * @returns Error message or null if valid
   */
  validateTextLength: (value: string, field: Field): string | null => {
    if (!value) return null;
    
    if (field.minValue !== null && value.length < field.minValue) {
      return `Minimum length required: ${field.minValue}`;
    }
    
    if (field.maxValue !== null && value.length > field.maxValue) {
      return `Maximum length exceeded: ${field.maxValue}`;
    }
    
    return null;
  },
  
  /**
   * Validates number input against min/max constraints
   * @param value Number value to validate
   * @param field Field configuration with min/max values
   * @returns Error message or null if valid
   */
  validateNumber: (value: number | null, field: Field): string | null => {
    if (value === null) return null;
    
    if (field.minValue !== null && value < field.minValue) {
      return `Minimum value: ${field.minValue}`;
    }
    
    if (field.maxValue !== null && value > field.maxValue) {
      return `Maximum value: ${field.maxValue}`;
    }
    
    return null;
  },
  
  /**
   * Validates an array of items against min/max constraints
   * @param items Array to validate
   * @param field Field configuration with min/max values
   * @returns Array of error messages or null if valid
   */
  validateCollection: validateFieldCollection
}; 