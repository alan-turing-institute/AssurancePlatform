"use server";

import { EmailClient } from "@azure/communication-email";

// Configuration
const ACS_CONNECTION_STRING = process.env.ACS_CONNECTION_STRING;
const ACS_SENDER_ADDRESS =
	process.env.ACS_SENDER_ADDRESS ||
	"DoNotReply@f6c20413-1d38-4929-b7d6-3e24bd86ad11.azurecomm.net";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const APP_NAME = "TEA Platform";

// Base64 encoded white TEA logo (tea-logo-icon-dark.png) for email templates
// This ensures the logo displays correctly regardless of email client or environment
const TEA_LOGO_BASE64 =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA5wAAANcCAYAAAAzWqBlAAAACXBIWXMAAC4jAAAuIwF4pT92AAAgAElEQVR4nO3d7ZFUR5r34f88sd+7PaBkAT0WULJAyAJKFqjGAhUWbGPBFBYsWKDGggEL1O0BbQHPh4QRQkC/1Z15Tp3ripiI3RlBHr1Eq35158n8x4cPHwIAAACH9v9GPwAAAADHSXACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACwO2sk+wGPwMAzMo/Pnz4MPoZAGAO3iZZffzP+6FPAgAzYcIJADfbJHmc5CTJ+dhHAYD5MOEEgO87TXKZFpuf/DNt4gkAfIcJJwB83y5/jc3ElBMAbsWEEwC+bZXkj2/8b78k2Xd7EgCYIcEJAN92keTJN/63qyRncYAQAHyTLbUA8HXrfDs2k+RRkm2fRwGAeTLhBICvu0yLyu+5TptyXlY/DADMkQknAPzdLjfHZtIOE9qVPgkAzJgJJwD81deuQbnJj2nvewIAnzHhBIC/Os/dYvPTrwEAviA4AeBPZ0me3ePXPU6yOeyjAMD82VILAH+6yPdPpv2e67R7O12TAgAfmXACQPM094/NpG3DdU0KAHzGhBMA2kFBb3O7k2lv8kNckwIASUw4ASBpk8lDxGbiACEA+C8TTgCWbpU23bzrybTf45oUAIgJJwDsctjYTJL9gX8/AJglwQnAkq1zv2tQ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sBiCE2AZ3qdNHX9IfVxsin9/Dm+b2snjuyQ/pv2zcVm4DgATIzgBluUyydO0D/9XBb//m7SJGfNymZqp43WSX9KmmhcFvz8AEyc4AZbpIm2b7b9y2MnW5oC/F32d57BfQjxP+2dsf8DfE4CZEZwAy3aeFgUvDvB7vYjtknP2adv1Q71O27q9i4OjABbvHx8+fBj9DABMwyptGvXkHr/2+uOvn1NgrD/+p9Jl5jfhu8j9/hm4SptwXxzwWQCYOcEJwJeepk0+H93h1/yS+YUVX7dO8vsd/vjrtGmmk2cB+BvBCcC37NJOLz254Y97l3YoDMdjn+TZLf64F7F1FoDvEJwAfM9p2uTqe/HxY2yjPDanaduBv/Vlw5u0LyPe9nogAObJoUEAfM/7tPfyfkyLjC+9jtg8Ru/z9S2yV0l+Ttt2KzYBuJEJJwB3sUnbQvnp/c4f4mTaY3aZ9vf6Oi1AdyMfBoD5EZwA3NVp2nbKb03BOB5PP/7n099vALgTwQkAAEAJ73ACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACAABQQnACU3ae5Gz0QwBM0CrJPsnp2McA+D7BCUzVJsmvSf4TH6oAPjlNskvyNsmzj/83wGT948OHD6OfAeBLp0kuk5x89t9dp008dwOeB2AKnqb9HHz0xX//Q9rPTIDJMeEEpmibv8ZmPv7/v6V9qFp3fh6Akc6SXCT5v/w9NpO2CwRgkkw4galZJfnjFn/cm7Rtt5eFzwIw0mnaRPPZLf7Yn5O8qn0cgLsz4QSm5vyWf9yTtDA9j/c7geOzS/tC7Taxmdz+ZydAV4ITmJJ1kp/u+Gt+TftQtj30wwAMsE77mfZb/v5qwfc8infcgQmypRaYkrdJHj/g179LC8+LgzwNQD+rtHcxnzzg97j++Pu8f/jjAByGCScwFds8LDbz8df/nvYe0+qhDwTQwaf3NP/Iw2IzaRNRW2uBSTHhBKbga9egHMLztA9fvu0HpmiT9jPq0D/7foydHsBEmHACU7DL4T9wJX9eo7Ip+L0B7mud9grBv1Pzs29X8HsC3IsJJzDaKre7BuWh3qR9CLvosBbA16zSJpp3PRztPn6J+zmBCRCcwGgXefh7S3fxMu19UdtsgZ52absuerlKchY/64DBbKkFRnqavrH5aU2A3tad13sU10UBE2DCCYx0mfahqCfbzIARzpL8p/Oa1x/Xvey8LsB/mXACo+zSPzbfRGwCY7xN29Lfk2tSgOFMOIERqq5BuYmrAoCR/OwDFseEExih4t65m7yMD1zAWO8z5soSU05gGBNOoDfvMQFLdxnvrwMLYcIJ9Dbim/bziE1gOjYD1jxP29IL0JXgBHrapP81KFexnQyYlou0Q8x6OolrUoABbKkFejlNO6Wx9zayn5O86rwmwE1WSf4YsO4PseMD6MiEE+hlmzHXoIhNYIouk7wYsO5+wJrAgplwAj2s0qabvU+m/efHdQGmyDUpwNEz4QR62GXMNShiE5iy9xnzXuV+wJrAQplwAtXWSX7vvOZ12lT1fed1Ae7jbZLHndf8VxyoBnRgwglUG3UNitgE5mLElHMX16QAHQhOoNIm/b+1v0r7IAUwFxdJXnde8yQmnEAHttQCVRyGAXB7qzhcDThCJpxAlW36f3B6E7EJzNNlxr2CAFDGhBOosIoLzQHu6jRt2tj7zuKf485ioIgJJ1BhxDfmLyI2gXl7nzHvoJtyAmVMOIFDW8c1KAAPcZHkSec1n8eBa0ABwQkc2mX6bwf7JS4yB47HOmO+uDuLnSLAgdlSCxzSNv1j813EJnBcLpK87LzmSUw4gQImnMChuAYF4HD8TAWOggkncCi79P9g9Do+GAHH6X3GHOazG7AmcMRMOIFDOEvynwHrugYFOHaX8V48MGMmnMAhjPgW/nnEJnD8tgPW3KVt6QV4MMEJPNTT9D++/yrujQOW4VWSN53XfJQxoQscIVtqgYe6jO1eAJW8tgDMlgkn8BC79I/NNxGbwLK8TfJiwLp2kgAPZsIJ3Jcj+wH68TMXmCUTTuC+ztP/g8/L+OADLNP7jLmyxJQTeBATTuA+1kl+77zmddp7TJed1wWYksv0f5XhXxGewD2ZcAL3sRuw5nnEJsBmwJq7uCYFuCfBCdzVJmOuQdl1XhNgii6SvO685kn8DAbuyZZa4C5O005L7L2d6+e0u+gASFZJ/hiwrmtSgDsz4QTuYpsx16CITYA/XSZ5PmDd/YA1gZkz4QRua5U23ex9Mu0/P64LwJ9ckwLMggkncFujrkERmwB/9z5t10lv+wFrAjNmwgncxjpjrkFZpX2oAuDr3iZ53HnN53GIEHBLJpzAbYy4f20XsQlwkxFTzm1ckwLckuAEbrJJ/2/Pr+KScYDbuEh7/aCnk/gZDdySLbXA9ziUAmD6VnGoGzBRJpzA9+zS/wPMm4hNgLu4zJiJoykncCMTTuBbVnGxOMBcnKZNG3vflfxz3JUMfIcJJ/At+wFrPs98YvM0Yw7rAPia9xlzcux5HCAEfIfgBL5mneRJ5zWvM5/tWZu0MP7fiE5gOvZpryX09Ch+DgLfITiBr9kPWHOb6V+Dsk7bsvbv/Plu6y6+3QemYz9gzW3aaxgAfyM4gS9t0/8doHcZ8yHptlZp7yj9nr9fEXMSF6AD07EbsKafg8A3OTQI+JxrUP7q03uav93ij3XYETDaLrf7eVVlqj/LgYFMOIHPnad/bL7OND+gbNK2z972w9u+7EkAbjaFg8x2g9cHJkhwAp+cJXnWec3rjP+A9KV1WgD/O3fbWvzk468FGGHEF4ZfepL2ZR3Af9lSC3xykf4n0z7PdL4RX6U9y0Oi+yoOzgD6O0vyn9EP8dF12s/BqR8CB3RiwgkkydP0j82rTOcalF3a9tmHTngfZToBDSzHVH6WJm3KOrWdK8BAJpxA0g676X0y7S8Z/97j07QPaof8c/ftPtDTJu0VgKlxkBqQxIQTaBO53rH5JmNj8yxtC/H/5fB/7ieZ1rQBOF6nme6uCj8HgSSCE5ZulTFbn3YD1kzah7N92rtOlVuIn6VFLUClEfcm39ZPcZAaEMEJS7dL/1MNX2bMNSi7tO1dvU7i9e0+UGmV6b8ruR/9AMB4ghOWa51lXIOyTgvN39I3rp+kvSMKUGGX8deg3ORRph/FQDGHBsFyXeS4r0FZpX273vvP8XNXaVtrHSAEHNI6ye+jH+KWHKQGC2fCCcu0yZhrUHYd1jlN2876R8bGZuLbfaDGnLbsn2S6BxsBHZhwwvKcpm0x7b0V6+ckr4rX2GZ628yu06acl4OfAzgOm0zzGpSbuCYFFsqEE5Znm/5B9ia1sblO8jbJ/2ZasZn4dh84nE87OOZoP/oBgDEEJyzLKu3wnN6qtpWu0kL29ySPi9Y4hGdxPQDwcCO+MDwUB6nBQtlSC8vyKu1utJ5e5PDBefrx9xwRz/f1JqITuL9V2rvpc3aV9ucBLIgJJyzHOv1j8zqH3066yZ/XnMzJk7RnB7iPuW6l/dyjeMUAFseEE5bjbfpvO/1XDvchaZ32QWX0ybMP4XoA4D7Wmc81KDfxcxAWxoQTlmGb/rF5lcPE5irtsInfM+/YTFr0n45+CGB29qMf4IBOchzTWuCWTDjh+I26BuXHJBcP+PWf3tOc8yEZn3y6g3Q/9jGAGdqmncB9bP6Z9iUccOQEJxy/8yS/dl7zdR52GuHTtOd+dJjHGeY67c/jPLaPAXc36gvDHhykBgshOOG4rTLmVMP7XvB9lhZnc986m7To3sZF58D9jfjCsKdfYucHHD3vcMJx2w9Y83nuHlmnac/6n8w/Nt+lbSd+GrEJ3N9Zjjs2k/aqgffa4cgJTjhe6/SPt09bSO9ilxZmzw79MJ1dp31bf5aHvbsKkIw5WOe683qPcvh7moGJEZxwvPYD1tzm9u8qrvPnfZpzfz/pef48TRfgoZ5mzBeGD3n3/r62aT8/gSMlOOE47dL/wJ13uV1wrdImgL9n/ocCvU57X3UXhwIBh63ddzgAAAu6SURBVDNiurlN+9n8svO6J2k/Q4Ej5dAgOD5TvQblNO1DxTG8k3SVZBNbZ4HD26Xt/Ojp8xNjp/rvEGCmTDjh+Jyn/weFl/n+B4VPp7XOPTavk/wrf05pAQ7p0/3Dve0++7/fZ8yEdcSaQAcmnHBcztJOeu3p+uO6l1/539Zp22znvnU2SV7E1lmg1j79D1B7mbZj40uX6f+z2zUpcIRMOOG4jPpW+vKL/26V5FWO4z3NN2nvad7lQCSAu1qnf2xe59vvT276PcZ/ncc1KXB0BCccjxGnGl7lr5H76T3NP5L81PlZDu0qyc/58zRdgEq7AWt+7QvDTy7SvnDr6SSuSYGjY0stHIfTJG8zdvvTJmPeHz20T3eJ7gY/B7AcmyT/7rzmVW6+jmSV9gVibz/EF31wNEw44Ths0z8236TF5jotdv+d+cfmy7QPWLuxjwEsyKedIb3dZpJ4mfb+em/7AWsCRUw4Yf5WacHXO/Z+TtvG2/udowpv0j58vR39IMDi7DL2GpSbuCYFeBDBCfO3z5iDJpL5TzSv0j7s7cc+BrBQq4z5wvCfudsXbJtMc8svMAO21MK8rTNmwniSecfmdZLnade57Mc+CrBgo+5Nvutujn2Sd4d/lO96FAcIwVEw4YR5e5vk8eiHmJmXaVPNy7GPASzcOu3qqJ6u06aG97niaZ15PS8wESacMF+biM27eJf2TtAmYhMYb8S9ybvcP94ukrw+2JPczkkc4gazZ8IJ8zTqEIc5uk7blrUf/BwAn2wyz3ciVxlzTcpd3zkFJsSEE+ZpG7F5G8/TPiDtxz4GwH+dZsx0c3OA3+My7edqbyP+egEHYsIJ87PKmG+Y5+R1WpRfDn4OgC/tMu1rUG5ymjZt7H33889JXnVeEzgAwQnz8yrJT6MfYqKu0r7Fvxj7GABftcqYLwx/yGG/gNtknluCgQFsqYV5WUdsfs11kn+lfRi5GPokAN+2H7Dmixx+t8c+bWra06M4QAhmyYQT5uUy/bcxTd2LPOzkRYAe1jmua0XWOa4/H6CICSfMxzZi83Nv0raJbePDBzB9+wFrVv58vEi717inkzhACGbHhBPmwTUof/KeJjA32yT/23nNd0nOitdYpR0g1PvfTT/GvwNgNkw4YR52EZvX+fOak4uhTwJwe6cZ8+7htsMalxkzcdwNWBO4JxNOmL5VXIPyMrbOAvO0T/Ks85qvkzztuN5l+r/y8UvcsQyzIDhh+i6SPBn9EIO8SQvNt6MfBOAezpL8Z8C6h74G5SZPk/xfx/WS9nrFWXwRCZNnSy1M29MsMzav0i75XkdsAvM1Yrvp8/SNzaTdDz3impQe24aBBzLhhGm7zLJOpr1O+4B2Ht9aA/O2tKnfiGnu9cd1LzuvC9yBCSdM1y7Lis2XaR8cdhGbwPyNOkxn1M/Pt3FNCvAVJpwwTUu6BuVN2oeki7GPAXAwuyS/dV7zTdprCCON+neXa1Jgwkw4YZrOc/yxeZ12yuA6PigAx2OVMe8W7gas+aX3GfMcppwwYYITpmed/kfo9/bpPs392McAOLhd+n9h+DLT+eLuPO1d0p4eJ9l0XhO4JVtqYXoucrwn075O++b/cvBzAFRYJ/m985rXaV/gTend93X8dQA++p/RDwD8xSbHG5vXae/37Ac/xxLt468707LJcU6kVoPWfTVo3Sk5SZsuuyoFJsaEE6bjNO2UvyWdTEsfzzON97vgk136H6rDMvwQu2hgUrzDCdOxjdgEgIfYj34A4K8EJ0zDKrYBAcBDPcn462GAzwhOmIYlXIMCAD3sRz8A8CfBCeOtk/w0+iEA4Eg8il1DMBmCE8ZzYTUAHNYu7TA+YDDBCWNt0i6sBgAO5yS+0IVJEJwwzmn8yxAAqjxLcjb6IWDpBCeMs42DggCgki92YTDBCWOs4tJzAKj2JMnT0Q8BSyY4YYz96AcAgIUw5YSBBCf0t077xhUAqPco7dRaYADBCf3tRz8AACzMNu11FqAzwQl9bdO+aQUA+jmJKScMITihn9P4lx0AjPIs7bUWoCPBCf3s4hoUABhpN/oBYGkEJ/RxluTX0Q8BAAv3JMlm9EPAkghO6MOR7AAwDbu011yADgQn1Hsa16AAwFQ8SjvED+hAcEI9000AmJbf4poU6EJwQq1dXIMCAFPkC2HoQHBCnVVs2QGAqfoprkmBcoIT6uziGhQAmDJTTigmOKHGOu2CaQBguh7HbiQo9T+jHwCO1GmS56MfAj66GP0A8IWL0Q8AQB//+PDhw+hnAAAA4AjZUgsAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAEAJwQkAAECJ/w8XgqBwBwkJLgAAAABJRU5ErkJggg==";

// Types
type EmailResult =
	| { success: true; messageId: string }
	| { success: false; error: string };

type PasswordResetEmailParams = {
	to: string;
	username: string;
	resetToken: string;
	expiresInMinutes?: number;
};

type WelcomeEmailParams = {
	to: string;
	username: string;
};

type AccountDeletedEmailParams = {
	to: string;
	username: string;
};

/**
 * Get the Azure Communication Services email client.
 * Returns null if not configured (for development/testing).
 */
function getEmailClient(): EmailClient | null {
	if (!ACS_CONNECTION_STRING) {
		console.warn(
			"ACS_CONNECTION_STRING not configured - emails will be logged only"
		);
		return null;
	}

	return new EmailClient(ACS_CONNECTION_STRING);
}

/**
 * Send an email using Azure Communication Services.
 * Falls back to console logging in development when ACS is not configured.
 */
async function sendEmail(
	to: string,
	subject: string,
	htmlContent: string,
	plainTextContent: string
): Promise<EmailResult> {
	const client = getEmailClient();

	if (!client) {
		// Development fallback - log the email
		console.log("=== EMAIL (Development Mode) ===");
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log(`Content: ${plainTextContent}`);
		console.log("================================");
		return { success: true, messageId: `dev-${Date.now()}` };
	}

	try {
		const message = {
			senderAddress: ACS_SENDER_ADDRESS,
			content: {
				subject,
				plainText: plainTextContent,
				html: htmlContent,
			},
			recipients: {
				to: [{ address: to }],
			},
		};

		const poller = await client.beginSend(message);
		const result = await poller.pollUntilDone();

		if (result.status === "Succeeded") {
			return { success: true, messageId: result.id };
		}

		return {
			success: false,
			error: result.error?.message || "Email sending failed",
		};
	} catch (error) {
		console.error("Email sending error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown email error",
		};
	}
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(
	params: PasswordResetEmailParams
): Promise<EmailResult> {
	const { to, username, resetToken, expiresInMinutes = 60 } = params;
	const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

	const subject = `Reset your ${APP_NAME} password`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #1a1f2e; padding: 24px 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <img src="${TEA_LOGO_BASE64}" alt="${APP_NAME}" style="max-width: 280px; height: auto;">
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Password Reset Request</h2>

    <p>Hello ${username},</p>

    <p>We received a request to reset your password for your ${APP_NAME} account. If you made this request, click the button below to set a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #1a1f2e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in ${expiresInMinutes} minutes.</p>

    <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 30px 0;">

    <p style="color: #999; font-size: 12px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #1a1f2e; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Password Reset Request

Hello ${username},

We received a request to reset your password for your ${APP_NAME} account.

To reset your password, visit the following link:
${resetUrl}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}

/**
 * Send a welcome email to new users.
 */
export async function sendWelcomeEmail(
	params: WelcomeEmailParams
): Promise<EmailResult> {
	const { to, username } = params;
	const loginUrl = `${APP_URL}/login`;

	const subject = `Welcome to ${APP_NAME}!`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #1a1f2e; padding: 24px 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <img src="${TEA_LOGO_BASE64}" alt="${APP_NAME}" style="max-width: 280px; height: auto;">
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Welcome to ${APP_NAME}!</h2>

    <p>Hello ${username},</p>

    <p>Thank you for creating an account with ${APP_NAME}. We're excited to have you on board!</p>

    <p>With ${APP_NAME}, you can:</p>
    <ul>
      <li>Create and manage assurance cases</li>
      <li>Collaborate with your team</li>
      <li>Share and publish your work</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="background: #1a1f2e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Get Started
      </a>
    </div>

    <p>If you have any questions, feel free to reach out to our support team.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Welcome to ${APP_NAME}!

Hello ${username},

Thank you for creating an account with ${APP_NAME}. We're excited to have you on board!

With ${APP_NAME}, you can:
- Create and manage assurance cases
- Collaborate with your team
- Share and publish your work

Get started: ${loginUrl}

If you have any questions, feel free to reach out to our support team.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}

/**
 * Send an account deletion confirmation email.
 */
export async function sendAccountDeletedEmail(
	params: AccountDeletedEmailParams
): Promise<EmailResult> {
	const { to, username } = params;

	const subject = `Your ${APP_NAME} account has been deleted`;

	const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: #1a1f2e; padding: 24px 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <img src="${TEA_LOGO_BASE64}" alt="${APP_NAME}" style="max-width: 280px; height: auto;">
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1a1f2e; margin-top: 0;">Account Deleted</h2>

    <p>Hello ${username},</p>

    <p>This email confirms that your ${APP_NAME} account has been successfully deleted as requested.</p>

    <p>What this means:</p>
    <ul>
      <li>Your personal data has been removed from our systems</li>
      <li>Any cases you owned have been transferred or deleted</li>
      <li>You will no longer receive emails from us</li>
    </ul>

    <p>If you did not request this deletion, please contact our support team immediately.</p>

    <p>We're sorry to see you go. If you ever want to return, you're always welcome to create a new account.</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>
</body>
</html>
`;

	const plainTextContent = `
Account Deleted

Hello ${username},

This email confirms that your ${APP_NAME} account has been successfully deleted as requested.

What this means:
- Your personal data has been removed from our systems
- Any cases you owned have been transferred or deleted
- You will no longer receive emails from us

If you did not request this deletion, please contact our support team immediately.

We're sorry to see you go. If you ever want to return, you're always welcome to create a new account.

---
${APP_NAME}
`;

	return await sendEmail(to, subject, htmlContent, plainTextContent);
}
