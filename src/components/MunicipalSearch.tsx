import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { IbgeMunicipio, MunicipioSelecionado } from "@/hooks/useMunicipalDiagnostic";

interface Props {
  municipios: IbgeMunicipio[];
  isLoading: boolean;
  selecionado: MunicipioSelecionado | null;
  onSelect: (m: IbgeMunicipio) => void;
  onClear: () => void;
}

export function MunicipalSearch({ municipios, isLoading, selecionado, onSelect, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const resultados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    if (termo.length < 2) return [];
    return municipios
      .filter((m) => m.nome.toLowerCase().includes(termo))
      .slice(0, 10);
  }, [municipios, search]);

  function handleSelect(m: IbgeMunicipio) {
    onSelect(m);
    setOpen(false);
    setSearch("");
  }

  const label = selecionado
    ? `${selecionado.nome} — ${selecionado.uf}`
    : "Buscar município...";

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !selecionado && "text-muted-foreground",
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Carregando municípios...
              </span>
            ) : (
              label
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Digite o nome do município..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {search.trim().length < 2 ? (
                <CommandEmpty className="py-4 text-xs text-muted-foreground">
                  Digite ao menos 2 letras para buscar.
                </CommandEmpty>
              ) : resultados.length === 0 ? (
                <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
              ) : (
                <CommandGroup heading={`${resultados.length} resultado(s)`}>
                  {resultados.map((m) => {
                    const uf = m.microrregiao.mesorregiao.UF.sigla;
                    const isSelected = selecionado?.id === m.id;
                    return (
                      <CommandItem
                        key={m.id}
                        value={`${m.nome}-${m.id}`}
                        onSelect={() => handleSelect(m)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")}
                        />
                        <span className="flex-1">{m.nome}</span>
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {uf}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selecionado && (
        <Button variant="ghost" size="icon" onClick={onClear} title="Limpar seleção">
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
