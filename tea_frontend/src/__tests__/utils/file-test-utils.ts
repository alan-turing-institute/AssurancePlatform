/**
 * Comprehensive File Handling Test Utilities for the TEA Platform
 *
 * This module provides utilities for testing file operations including:
 * - File and FileList mocking
 * - File upload component testing
 * - Drag-and-drop functionality testing
 * - File download simulation
 * - Blob and URL.createObjectURL mocking
 * - File validation testing
 */

import { vi, expect } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Common MIME types used in the TEA Platform
 */
export const MIME_TYPES = {
  // Images
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  GIF: 'image/gif',
  SVG: 'image/svg+xml',
  WEBP: 'image/webp',
  BMP: 'image/bmp',

  // Documents
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Text
  TXT: 'text/plain',
  CSV: 'text/csv',
  RTF: 'text/rtf',
  XML: 'application/xml',
  HTML: 'text/html',

  // JSON and structured data
  JSON: 'application/json',

  // Archives
  ZIP: 'application/zip',
  RAR: 'application/x-rar-compressed',
  TAR: 'application/x-tar',
  GZIP: 'application/gzip',

  // Other
  OCTET_STREAM: 'application/octet-stream',
} as const;

/**
 * File size constants for testing
 */
export const FILE_SIZES = {
  EMPTY: 0,
  SMALL: 1024, // 1KB
  MEDIUM: 1024 * 1024, // 1MB
  LARGE: 10 * 1024 * 1024, // 10MB
  XLARGE: 50 * 1024 * 1024, // 50MB
  TOO_LARGE: 100 * 1024 * 1024, // 100MB
} as const;

/**
 * Configuration options for creating mock files
 */
export interface MockFileOptions {
  name?: string;
  type?: string;
  size?: number;
  lastModified?: number;
  content?: string | ArrayBuffer | ArrayBufferView;
}

/**
 * Options for drag and drop event simulation
 */
export interface DragDropOptions {
  clientX?: number;
  clientY?: number;
  screenX?: number;
  screenY?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * File validation error types
 */
export enum FileValidationError {
  INVALID_TYPE = 'INVALID_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TOO_SMALL = 'FILE_TOO_SMALL',
  EMPTY_FILE = 'EMPTY_FILE',
  INVALID_NAME = 'INVALID_NAME',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
}

/**
 * Mock URL object for testing file URLs
 */
export class MockURL {
  static objectURLs: Map<string, Blob | MediaSource> = new Map();
  static revokedURLs: Set<string> = new Set();

  /**
   * Mock implementation of URL.createObjectURL
   */
  static createObjectURL = vi.fn((object: Blob | MediaSource): string => {
    const url = `blob:http://localhost:3000/${Math.random().toString(36).substr(2, 9)}`;
    MockURL.objectURLs.set(url, object);
    return url;
  });

  /**
   * Mock implementation of URL.revokeObjectURL
   */
  static revokeObjectURL = vi.fn((url: string): void => {
    MockURL.objectURLs.delete(url);
    MockURL.revokedURLs.add(url);
  });

  /**
   * Check if a URL has been created
   */
  static hasObjectURL(url: string): boolean {
    return MockURL.objectURLs.has(url);
  }

  /**
   * Check if a URL has been revoked
   */
  static isRevoked(url: string): boolean {
    return MockURL.revokedURLs.has(url);
  }

  /**
   * Get the object associated with a URL
   */
  static getObjectForURL(url: string): Blob | MediaSource | undefined {
    return MockURL.objectURLs.get(url);
  }

  /**
   * Clear all object URLs (useful for test cleanup)
   */
  static clearObjectURLs(): void {
    MockURL.objectURLs.clear();
    MockURL.revokedURLs.clear();
  }
}

/**
 * Creates a mock File object with specified properties
 * @param options - Configuration options for the mock file
 * @returns A mock File object
 */
export function createMockFile(options: MockFileOptions = {}): File {
  const {
    name = 'test-file.txt',
    type = MIME_TYPES.TXT,
    size = FILE_SIZES.SMALL,
    lastModified = Date.now(),
    content = 'Mock file content',
  } = options;

  // Create the file content
  let fileContent: ArrayBuffer;
  if (typeof content === 'string') {
    const encoded = new TextEncoder().encode(content);
    if (encoded.buffer instanceof ArrayBuffer) {
      fileContent = encoded.buffer;
    } else {
      // Handle SharedArrayBuffer case - copy to new ArrayBuffer
      const sourceArray = new Uint8Array(encoded.buffer);
      const newBuffer = new ArrayBuffer(sourceArray.length);
      const newArray = new Uint8Array(newBuffer);
      newArray.set(sourceArray);
      fileContent = newBuffer;
    }
  } else if (content instanceof ArrayBuffer) {
    fileContent = content;
  } else if (content instanceof SharedArrayBuffer) {
    // Convert SharedArrayBuffer to ArrayBuffer
    const tempArray = new Uint8Array(content);
    const newBuffer = new ArrayBuffer(tempArray.length);
    const newArray = new Uint8Array(newBuffer);
    newArray.set(tempArray);
    fileContent = newBuffer;
  } else {
    // Handle ArrayBufferView types (like Uint8Array, etc.)
    const view = content as ArrayBufferView;
    if (view.buffer instanceof ArrayBuffer) {
      fileContent = view.buffer.slice(
        view.byteOffset,
        view.byteOffset + view.byteLength
      );
    } else {
      // Handle SharedArrayBuffer case for ArrayBufferView
      const sourceArray = new Uint8Array(
        view.buffer,
        view.byteOffset,
        view.byteLength
      );
      const newBuffer = new ArrayBuffer(sourceArray.length);
      const newArray = new Uint8Array(newBuffer);
      newArray.set(sourceArray);
      fileContent = newBuffer;
    }
  }

  // Use specified size or fall back to actual content size
  const actualSize = size;

  const file = new File([fileContent], name, {
    type,
    lastModified,
  });

  // Override the size property to match the specified size
  Object.defineProperty(file, 'size', {
    value: actualSize,
    writable: false,
  });

  return file;
}

/**
 * Creates a mock FileList containing the specified files
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number): File | null => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // Add indexed properties
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      value: file,
      enumerable: true,
    });
  });

  return fileList as FileList;
}

/**
 * Creates commonly used test files for different scenarios
 */
export class TestFileFactory {
  /**
   * Create a valid image file for testing screenshot uploads
   */
  static createImageFile(options: Partial<MockFileOptions> = {}): File {
    return createMockFile({
      name: 'screenshot.png',
      type: MIME_TYPES.PNG,
      size: FILE_SIZES.MEDIUM,
      content: 'fake-png-data',
      ...options,
    });
  }

  /**
   * Create a valid PDF file for testing document uploads
   */
  static createPDFFile(options: Partial<MockFileOptions> = {}): File {
    return createMockFile({
      name: 'document.pdf',
      type: MIME_TYPES.PDF,
      size: FILE_SIZES.LARGE,
      content: 'fake-pdf-data',
      ...options,
    });
  }

  /**
   * Create a JSON file for testing case exports/imports
   */
  static createJSONFile(options: Partial<MockFileOptions> = {}): File {
    const defaultData = {
      assuranceCase: {
        id: 1,
        name: 'Test Case',
        goals: [],
        evidence: [],
      },
    };

    return createMockFile({
      name: 'assurance-case.json',
      type: MIME_TYPES.JSON,
      size: FILE_SIZES.SMALL,
      content: JSON.stringify(defaultData, null, 2),
      ...options,
    });
  }

  /**
   * Create a text file for testing
   */
  static createTextFile(options: Partial<MockFileOptions> = {}): File {
    return createMockFile({
      name: 'document.txt',
      type: MIME_TYPES.TXT,
      size: FILE_SIZES.SMALL,
      content: 'This is a test text file.',
      ...options,
    });
  }

  /**
   * Create an oversized file for testing size validation
   */
  static createOversizedFile(options: Partial<MockFileOptions> = {}): File {
    return createMockFile({
      name: 'large-file.pdf',
      type: MIME_TYPES.PDF,
      size: FILE_SIZES.TOO_LARGE,
      content: 'large-file-content',
      ...options,
    });
  }

  /**
   * Create an empty file for testing empty file validation
   */
  static createEmptyFile(options: Partial<MockFileOptions> = {}): File {
    return createMockFile({
      name: 'empty.txt',
      type: MIME_TYPES.TXT,
      size: FILE_SIZES.EMPTY,
      content: '',
      ...options,
    });
  }

  /**
   * Create a file with an invalid type for testing type validation
   */
  static createInvalidTypeFile(options: Partial<MockFileOptions> = {}): File {
    return createMockFile({
      name: 'malicious.exe',
      type: 'application/x-msdownload',
      size: FILE_SIZES.SMALL,
      content: 'executable-content',
      ...options,
    });
  }

  /**
   * Create multiple files for batch testing
   */
  static createMultipleFiles(count: number = 3): File[] {
    return Array.from({ length: count }, (_, index) =>
      createMockFile({
        name: `file-${index + 1}.txt`,
        type: MIME_TYPES.TXT,
        size: FILE_SIZES.SMALL,
        content: `Content of file ${index + 1}`,
      })
    );
  }
}

/**
 * Utilities for testing drag and drop functionality
 */
export class DragDropTestUtils {
  /**
   * Create a mock DataTransfer object for drag and drop events
   */
  static createMockDataTransfer(files: File[] = []): DataTransfer {
    const items: DataTransferItem[] = files.map((file) => ({
      kind: 'file' as const,
      type: file.type,
      getAsFile: () => file,
      getAsString: (callback: (data: string) => void) => {
        // For file items, this would typically not be used
        callback('');
      },
      webkitGetAsEntry: () => null,
    }));

    const dataTransfer = {
      dropEffect: 'none' as DataTransfer['dropEffect'],
      effectAllowed: 'all' as DataTransfer['effectAllowed'],
      files: createMockFileList(files),
      items: {
        length: items.length,
        add: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
        ...items.reduce(
          (acc, item, index) => {
            acc[index] = item;
            return acc;
          },
          {} as Record<number, DataTransferItem>
        ),
        [Symbol.iterator]: function* () {
          for (const item of items) {
            yield item;
          }
        },
      } as DataTransferItemList,
      types: files.map(() => 'Files'),
      clearData: vi.fn(),
      getData: vi.fn(() => ''),
      setData: vi.fn(),
      setDragImage: vi.fn(),
    };

    return dataTransfer as DataTransfer;
  }

  /**
   * Create a drag enter event
   */
  static createDragEnterEvent(
    files: File[] = [],
    options: DragDropOptions = {}
  ): DragEvent {
    const dataTransfer = this.createMockDataTransfer(files);

    return new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: options.clientX,
      clientY: options.clientY,
      screenX: options.screenX,
      screenY: options.screenY,
      ctrlKey: options.ctrlKey,
      shiftKey: options.shiftKey,
      altKey: options.altKey,
      metaKey: options.metaKey,
    });
  }

  /**
   * Create a drag over event
   */
  static createDragOverEvent(
    files: File[] = [],
    options: DragDropOptions = {}
  ): DragEvent {
    const dataTransfer = this.createMockDataTransfer(files);

    return new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: options.clientX,
      clientY: options.clientY,
      screenX: options.screenX,
      screenY: options.screenY,
      ctrlKey: options.ctrlKey,
      shiftKey: options.shiftKey,
      altKey: options.altKey,
      metaKey: options.metaKey,
    });
  }

  /**
   * Create a drop event
   */
  static createDropEvent(
    files: File[] = [],
    options: DragDropOptions = {}
  ): DragEvent {
    const dataTransfer = this.createMockDataTransfer(files);

    return new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
      clientX: options.clientX,
      clientY: options.clientY,
      screenX: options.screenX,
      screenY: options.screenY,
      ctrlKey: options.ctrlKey,
      shiftKey: options.shiftKey,
      altKey: options.altKey,
      metaKey: options.metaKey,
    });
  }

  /**
   * Create a drag leave event
   */
  static createDragLeaveEvent(options: DragDropOptions = {}): DragEvent {
    return new DragEvent('dragleave', {
      bubbles: true,
      cancelable: true,
      clientX: options.clientX,
      clientY: options.clientY,
      screenX: options.screenX,
      screenY: options.screenY,
      ctrlKey: options.ctrlKey,
      shiftKey: options.shiftKey,
      altKey: options.altKey,
      metaKey: options.metaKey,
    });
  }

  /**
   * Simulate a complete drag and drop sequence
   */
  static async simulateDragAndDrop(
    element: HTMLElement,
    files: File[],
    options: DragDropOptions = {}
  ): Promise<void> {
    // Simulate drag enter
    const dragEnterEvent = this.createDragEnterEvent(files, options);
    element.dispatchEvent(dragEnterEvent);

    // Simulate drag over
    const dragOverEvent = this.createDragOverEvent(files, options);
    element.dispatchEvent(dragOverEvent);

    // Small delay to simulate real drag and drop timing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate drop
    const dropEvent = this.createDropEvent(files, options);
    element.dispatchEvent(dropEvent);
  }
}

/**
 * Utilities for testing file download functionality
 */
export class FileDownloadTestUtils {
  private static downloadLinks: HTMLAnchorElement[] = [];

  /**
   * Mock the creation of download links
   */
  static mockDownloadLink(): Mock {
    const originalCreateElement = document.createElement;

    return vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const link = originalCreateElement.call(
          document,
          'a'
        ) as HTMLAnchorElement;

        // Override the click method to track downloads
        const originalClick = link.click;
        link.click = vi.fn(() => {
          this.downloadLinks.push(link);
          originalClick.call(link);
        });

        return link;
      }
      return originalCreateElement.call(document, tagName);
    });
  }

  /**
   * Get all download links that were created
   */
  static getDownloadLinks(): HTMLAnchorElement[] {
    return [...this.downloadLinks];
  }

  /**
   * Get the last download link that was created
   */
  static getLastDownloadLink(): HTMLAnchorElement | undefined {
    return this.downloadLinks[this.downloadLinks.length - 1];
  }

  /**
   * Clear the download links history
   */
  static clearDownloadHistory(): void {
    this.downloadLinks = [];
  }

  /**
   * Assert that a download was triggered with specific properties
   */
  static assertDownloadTriggered(
    expectedFilename?: string,
    expectedHref?: string
  ): void {
    expect(this.downloadLinks.length).toBeGreaterThan(0);

    const lastLink = this.getLastDownloadLink()!;

    if (expectedFilename) {
      expect(lastLink.download).toBe(expectedFilename);
    }

    if (expectedHref) {
      expect(lastLink.href).toBe(expectedHref);
    }
  }

  /**
   * Create a mock blob for download testing
   */
  static createMockBlob(content: string, type: string = MIME_TYPES.JSON): Blob {
    return new Blob([content], { type });
  }
}

/**
 * File validation testing utilities
 */
export class FileValidationTestUtils {
  /**
   * Test file type validation
   */
  static validateFileType(
    file: File,
    allowedTypes: string[]
  ): { isValid: boolean; error?: FileValidationError } {
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: FileValidationError.INVALID_TYPE };
    }
    return { isValid: true };
  }

  /**
   * Test file size validation
   */
  static validateFileSize(
    file: File,
    maxSize: number,
    minSize: number = 0
  ): { isValid: boolean; error?: FileValidationError } {
    if (file.size === 0) {
      return { isValid: false, error: FileValidationError.EMPTY_FILE };
    }

    if (file.size < minSize) {
      return { isValid: false, error: FileValidationError.FILE_TOO_SMALL };
    }

    if (file.size > maxSize) {
      return { isValid: false, error: FileValidationError.FILE_TOO_LARGE };
    }

    return { isValid: true };
  }

  /**
   * Test file name validation
   */
  static validateFileName(
    file: File,
    pattern?: RegExp
  ): { isValid: boolean; error?: FileValidationError } {
    if (!file.name || file.name.trim() === '') {
      return { isValid: false, error: FileValidationError.INVALID_NAME };
    }

    if (pattern && !pattern.test(file.name)) {
      return { isValid: false, error: FileValidationError.INVALID_NAME };
    }

    return { isValid: true };
  }

  /**
   * Create a comprehensive validation function
   */
  static createValidator(options: {
    allowedTypes?: string[];
    maxSize?: number;
    minSize?: number;
    namePattern?: RegExp;
  }) {
    return (file: File) => {
      const results = [];

      if (options.allowedTypes) {
        results.push(this.validateFileType(file, options.allowedTypes));
      }

      if (options.maxSize !== undefined || options.minSize !== undefined) {
        results.push(
          this.validateFileSize(
            file,
            options.maxSize ?? Number.MAX_SAFE_INTEGER,
            options.minSize
          )
        );
      }

      if (options.namePattern) {
        results.push(this.validateFileName(file, options.namePattern));
      }

      const errors = results.filter((r) => !r.isValid).map((r) => r.error);

      return {
        isValid: errors.length === 0,
        errors,
      };
    };
  }
}

/**
 * File input testing utilities
 */
export class FileInputTestUtils {
  /**
   * Simulate file selection on a file input element
   */
  static async selectFiles(
    input: HTMLInputElement,
    files: File[]
  ): Promise<void> {
    // Create a mock FileList
    const fileList = createMockFileList(files);

    // Set the files property
    Object.defineProperty(input, 'files', {
      value: fileList,
      configurable: true,
    });

    // Trigger the change event
    const changeEvent = new Event('change', { bubbles: true });
    input.dispatchEvent(changeEvent);

    // Small delay to allow for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Create a file input element for testing
   */
  static createFileInput(
    options: {
      accept?: string;
      multiple?: boolean;
      name?: string;
      id?: string;
    } = {}
  ): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';

    if (options.accept) input.accept = options.accept;
    if (options.multiple) input.multiple = options.multiple;
    if (options.name) input.name = options.name;
    if (options.id) input.id = options.id;

    return input;
  }
}

/**
 * Setup and teardown utilities for file testing
 */
export class FileTestSetup {
  private static originalCreateObjectURL: typeof URL.createObjectURL;
  private static originalRevokeObjectURL: typeof URL.revokeObjectURL;
  private static originalCreateElement: typeof document.createElement;

  /**
   * Setup mock implementations for file-related APIs
   */
  static setup(): void {
    // Store original implementations
    this.originalCreateObjectURL = URL.createObjectURL;
    this.originalRevokeObjectURL = URL.revokeObjectURL;
    this.originalCreateElement = document.createElement;

    // Replace with mocks
    global.URL.createObjectURL = MockURL.createObjectURL;
    global.URL.revokeObjectURL = MockURL.revokeObjectURL;

    // Mock FileReader if needed
    if (!global.FileReader) {
      global.FileReader = class MockFileReader
        extends EventTarget
        implements FileReader
      {
        error: DOMException | null = null;
        readyState: 0 | 1 | 2 = FileReader.EMPTY;
        result: string | ArrayBuffer | null = null;

        EMPTY = FileReader.EMPTY;
        LOADING = FileReader.LOADING;
        DONE = FileReader.DONE;

        abort(): void {
          this.readyState = FileReader.DONE;
        }

        readAsArrayBuffer(file: Blob): void {
          setTimeout(() => {
            this.readyState = FileReader.DONE;
            this.result = new ArrayBuffer(0);
            this.dispatchEvent(new Event('load'));
          }, 0);
        }

        readAsBinaryString(file: Blob): void {
          setTimeout(() => {
            this.readyState = FileReader.DONE;
            this.result = '';
            this.dispatchEvent(new Event('load'));
          }, 0);
        }

        readAsDataURL(file: Blob): void {
          setTimeout(() => {
            this.readyState = FileReader.DONE;
            this.result = `data:${file.type};base64,${btoa('mock-file-content')}`;
            this.dispatchEvent(new Event('load'));
          }, 0);
        }

        readAsText(file: Blob, encoding?: string): void {
          setTimeout(() => {
            this.readyState = FileReader.DONE;
            this.result = 'mock-file-content';
            this.dispatchEvent(new Event('load'));
          }, 0);
        }

        onabort:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onerror:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onload:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onloadend:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onloadstart:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
        onprogress:
          | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
          | null = null;
      } as any;
    }
  }

  /**
   * Cleanup and restore original implementations
   */
  static cleanup(): void {
    // Restore original implementations
    if (this.originalCreateObjectURL) {
      global.URL.createObjectURL = this.originalCreateObjectURL;
    }

    if (this.originalRevokeObjectURL) {
      global.URL.revokeObjectURL = this.originalRevokeObjectURL;
    }

    if (this.originalCreateElement) {
      global.document.createElement = this.originalCreateElement;
    }

    // Clear mock data
    MockURL.clearObjectURLs();
    FileDownloadTestUtils.clearDownloadHistory();
  }
}

/**
 * Common file testing assertions
 */
export const fileAssertions = {
  /**
   * Assert that a file has expected properties
   */
  hasProperties(
    file: File,
    expected: Partial<Pick<File, 'name' | 'type' | 'size' | 'lastModified'>>
  ): void {
    if (expected.name !== undefined) {
      expect(file.name).toBe(expected.name);
    }
    if (expected.type !== undefined) {
      expect(file.type).toBe(expected.type);
    }
    if (expected.size !== undefined) {
      expect(file.size).toBe(expected.size);
    }
    if (expected.lastModified !== undefined) {
      expect(file.lastModified).toBe(expected.lastModified);
    }
  },

  /**
   * Assert that a FileList contains expected files
   */
  fileListContains(fileList: FileList, expectedFiles: File[]): void {
    expect(fileList.length).toBe(expectedFiles.length);

    for (let i = 0; i < expectedFiles.length; i++) {
      expect(fileList[i]).toBe(expectedFiles[i]);
    }
  },

  /**
   * Assert that a download was triggered
   */
  downloadTriggered(filename?: string, href?: string): void {
    FileDownloadTestUtils.assertDownloadTriggered(filename, href);
  },

  /**
   * Assert that an object URL was created
   */
  objectURLCreated(url: string): void {
    expect(MockURL.hasObjectURL(url)).toBe(true);
  },

  /**
   * Assert that an object URL was revoked
   */
  objectURLRevoked(url: string): void {
    expect(MockURL.isRevoked(url)).toBe(true);
  },
};

// All exports are already declared above with their class/function definitions
