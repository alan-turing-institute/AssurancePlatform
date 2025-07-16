'use client';

import { zodResolver } from '@hookform/resolvers/zod';
// import { useLoginToken } from ".*/use-auth";
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useImportModal } from '@/hooks/use-import-modal';

const ACCEPTED_FILE_TYPES = ['application/json']; // Correct MIME type for JSON files

const formSchema = z.object({
  file: z.any().refine((files) => {
    if (!files) {
      return 'Please select a file.';
    }
    if (!(files instanceof FileList)) {
      return 'Expected a file.';
    }
    const filesArray = Array.from(files);
    if (!filesArray.every((file) => ACCEPTED_FILE_TYPES.includes(file.type))) {
      return 'Only JSON files are allowed.';
    }
    return true; // Validation passed
  }),
});

export const ImportModal = () => {
  const importModal = useImportModal();
  // const [token] = useLoginToken();
  const { data: session } = useSession();

  const [_loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  const ImportCreateCase = useCallback(
    (json: unknown) => {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${session?.key}`,
        },
        body: JSON.stringify(json),
      };

      setLoading(true);

      fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/`,
        requestOptions
      )
        .then((response) => response.json())
        .then((responseData) => {
          const responseJson = responseData;
          if ((responseJson as { id?: number }).id) {
            // navigate("/case/" + json.id);
            importModal.onClose();
            router.push(`/case/${(responseJson as { id: number }).id}`);
          } else {
            setLoading(false);
            setError('An error occurred, please try again later');
          }
        })
        .catch((_ex) => {
          setLoading(false);
          setError('An error occurred, please try again later');
        });
    },
    [session, importModal, router]
  );

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const { file } = values;

    try {
      if (file) {
        const fileReader = new FileReader();

        fileReader.onload = async (event: ProgressEvent<FileReader>) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            await ImportCreateCase(json);
          } catch (_error) {
            setError('Error parsing JSON file, bad format.');
          }
        };

        fileReader.readAsText(file);
      }
    } catch (_error) {
      setError('Error reading file');
    }
  };

  const handleModalClose = () => {
    setError('');
    importModal.onClose();
  };

  return (
    <Modal
      description="Please select a file you wish to import to create your case."
      isOpen={importModal.isOpen}
      onClose={handleModalClose}
      title="Import File"
    >
      {error && (
        <div className="pb-2 font-semibold text-rose-500 text-sm">{error}</div>
      )}
      <Form {...form}>
        <form
          className="w-full space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="file"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                {/* <FormLabel>File</FormLabel> */}
                <FormControl>
                  <Input
                    {...fieldProps}
                    onChange={(event) => onChange(event.target.files?.[0])}
                    type="file"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
    </Modal>
  );
};
