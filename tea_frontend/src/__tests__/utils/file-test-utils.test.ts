/**
 * Tests for file-test-utils.ts
 * Basic validation to ensure our utilities work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockFile,
  createMockFileList,
  TestFileFactory,
  DragDropTestUtils,
  FileDownloadTestUtils,
  FileValidationTestUtils,
  FileInputTestUtils,
  FileTestSetup,
  MockURL,
  MIME_TYPES,
  FILE_SIZES,
  FileValidationError,
  fileAssertions,
} from './file-test-utils';

describe('File Test Utilities', () => {
  beforeEach(() => {
    FileTestSetup.setup();
  });

  afterEach(() => {
    FileTestSetup.cleanup();
  });

  describe('createMockFile', () => {
    it('should create a basic mock file with default values', () => {
      const file = createMockFile();

      expect(file.name).toBe('test-file.txt');
      expect(file.type).toBe(MIME_TYPES.TXT);
      expect(file.size).toBe(FILE_SIZES.SMALL);
      expect(file instanceof File).toBe(true);
    });

    it('should create a mock file with custom options', () => {
      const file = createMockFile({
        name: 'custom.pdf',
        type: MIME_TYPES.PDF,
        size: FILE_SIZES.LARGE,
        content: 'custom content',
      });

      expect(file.name).toBe('custom.pdf');
      expect(file.type).toBe(MIME_TYPES.PDF);
      expect(file.size).toBe(FILE_SIZES.LARGE); // uses specified size
    });
  });

  describe('createMockFileList', () => {
    it('should create a mock FileList from files', () => {
      const files = [
        createMockFile({ name: 'file1.txt' }),
        createMockFile({ name: 'file2.txt' }),
      ];
      const fileList = createMockFileList(files);

      expect(fileList.length).toBe(2);
      expect(fileList[0].name).toBe('file1.txt');
      expect(fileList[1].name).toBe('file2.txt');
      expect(fileList.item(0)).toBe(files[0]);
    });
  });

  describe('TestFileFactory', () => {
    it('should create an image file', () => {
      const file = TestFileFactory.createImageFile();

      expect(file.name).toBe('screenshot.png');
      expect(file.type).toBe(MIME_TYPES.PNG);
      expect(file.size).toBe(FILE_SIZES.MEDIUM);
    });

    it('should create a PDF file', () => {
      const file = TestFileFactory.createPDFFile();

      expect(file.name).toBe('document.pdf');
      expect(file.type).toBe(MIME_TYPES.PDF);
      expect(file.size).toBe(FILE_SIZES.LARGE);
    });

    it('should create a JSON file', () => {
      const file = TestFileFactory.createJSONFile();

      expect(file.name).toBe('assurance-case.json');
      expect(file.type).toBe(MIME_TYPES.JSON);
    });

    it('should create multiple files', () => {
      const files = TestFileFactory.createMultipleFiles(3);

      expect(files).toHaveLength(3);
      expect(files[0].name).toBe('file-1.txt');
      expect(files[1].name).toBe('file-2.txt');
      expect(files[2].name).toBe('file-3.txt');
    });

    it('should create an oversized file', () => {
      const file = TestFileFactory.createOversizedFile();

      expect(file.size).toBe(FILE_SIZES.TOO_LARGE);
    });

    it('should create an empty file', () => {
      const file = TestFileFactory.createEmptyFile();

      expect(file.size).toBe(FILE_SIZES.EMPTY);
    });
  });

  describe('DragDropTestUtils', () => {
    it('should create mock DataTransfer', () => {
      const files = [TestFileFactory.createImageFile()];
      const dataTransfer = DragDropTestUtils.createMockDataTransfer(files);

      expect(dataTransfer.files.length).toBe(1);
      expect(dataTransfer.items.length).toBe(1);
      expect(dataTransfer.effectAllowed).toBe('all');
    });

    it('should create drag events', () => {
      const files = [TestFileFactory.createImageFile()];

      const dragEnterEvent = DragDropTestUtils.createDragEnterEvent(files);
      expect(dragEnterEvent.type).toBe('dragenter');

      const dragOverEvent = DragDropTestUtils.createDragOverEvent(files);
      expect(dragOverEvent.type).toBe('dragover');

      const dropEvent = DragDropTestUtils.createDropEvent(files);
      expect(dropEvent.type).toBe('drop');

      const dragLeaveEvent = DragDropTestUtils.createDragLeaveEvent();
      expect(dragLeaveEvent.type).toBe('dragleave');
    });
  });

  describe('FileValidationTestUtils', () => {
    it('should validate file types', () => {
      const imageFile = TestFileFactory.createImageFile();
      const result = FileValidationTestUtils.validateFileType(imageFile, [
        MIME_TYPES.PNG,
      ]);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid file types', () => {
      const imageFile = TestFileFactory.createImageFile();
      const result = FileValidationTestUtils.validateFileType(imageFile, [
        MIME_TYPES.PDF,
      ]);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FileValidationError.INVALID_TYPE);
    });

    it('should validate file sizes', () => {
      const smallFile = createMockFile({ size: 1000 });
      const result = FileValidationTestUtils.validateFileSize(smallFile, 2000);

      expect(result.isValid).toBe(true);
    });

    it('should reject oversized files', () => {
      const largeFile = createMockFile({ size: 3000 });
      const result = FileValidationTestUtils.validateFileSize(largeFile, 2000);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FileValidationError.FILE_TOO_LARGE);
    });

    it('should create a comprehensive validator', () => {
      const validator = FileValidationTestUtils.createValidator({
        allowedTypes: [MIME_TYPES.PNG],
        maxSize: 2000,
        minSize: 100,
      });

      const validFile = createMockFile({
        type: MIME_TYPES.PNG,
        size: 1000,
      });

      const result = validator(validFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('FileInputTestUtils', () => {
    it('should create a file input element', () => {
      const input = FileInputTestUtils.createFileInput({
        accept: 'image/*',
        multiple: true,
        name: 'test-input',
      });

      expect(input.type).toBe('file');
      expect(input.accept).toBe('image/*');
      expect(input.multiple).toBe(true);
      expect(input.name).toBe('test-input');
    });

    it('should simulate file selection', async () => {
      const input = FileInputTestUtils.createFileInput();
      const files = [TestFileFactory.createImageFile()];

      await FileInputTestUtils.selectFiles(input, files);

      expect(input.files?.length).toBe(1);
      expect(input.files?.[0].name).toBe('screenshot.png');
    });
  });

  describe('MockURL', () => {
    it('should create and track object URLs', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const url = MockURL.createObjectURL(blob);

      expect(typeof url).toBe('string');
      expect(url.startsWith('blob:http://localhost:3000/')).toBe(true);
      expect(MockURL.hasObjectURL(url)).toBe(true);
      expect(MockURL.getObjectForURL(url)).toBe(blob);
    });

    it('should revoke object URLs', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const url = MockURL.createObjectURL(blob);

      MockURL.revokeObjectURL(url);

      expect(MockURL.hasObjectURL(url)).toBe(false);
      expect(MockURL.isRevoked(url)).toBe(true);
    });

    it('should clear all URLs', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const url = MockURL.createObjectURL(blob);

      MockURL.clearObjectURLs();

      expect(MockURL.hasObjectURL(url)).toBe(false);
      expect(MockURL.isRevoked(url)).toBe(false);
    });
  });

  describe('fileAssertions', () => {
    it('should assert file properties', () => {
      const file = createMockFile({
        name: 'test.txt',
        type: MIME_TYPES.TXT,
        size: 1000,
      });

      expect(() => {
        fileAssertions.hasProperties(file, {
          name: 'test.txt',
          type: MIME_TYPES.TXT,
          size: 1000,
        });
      }).not.toThrow();
    });

    it('should assert FileList contents', () => {
      const files = [
        createMockFile({ name: 'file1.txt' }),
        createMockFile({ name: 'file2.txt' }),
      ];
      const fileList = createMockFileList(files);

      expect(() => {
        fileAssertions.fileListContains(fileList, files);
      }).not.toThrow();
    });
  });
});
