'use client';

import { MapPin, Navigation, X } from 'lucide-react';
import { openNavigation as openNavigationUrl, type NavigationOption } from './donorUtils';

type Props = {
  address: string | null;
  onClose: () => void;
};

/** חלון לבחירת אפליקציית ניווט (Waze / Google Maps / Apple Maps) */
export default function NavigationPicker({ address, onClose }: Props) {
  const navigationAddress = address;
  const setNavigationAddress = (value: null) => {
    if (value === null) onClose();
  };
  const openNavigation = (option: NavigationOption) => {
    if (address) openNavigationUrl(address, option);
    onClose();
  };

  return (
    <>
      {/* חלון בחירת אפליקציית ניווט */}

      {navigationAddress && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            bg-black/40
            flex
            items-center
            justify-center
            p-4
          "
          onClick={() =>
            setNavigationAddress(null)
          }
        >
          <div
            className="
              bg-white
              rounded-2xl
              shadow-2xl
              w-full
              max-w-sm
              overflow-hidden
            "
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div
              className="
                flex
                items-center
                justify-between
                px-5
                py-4
                border-b
                border-slate-100
              "
            >
              <div className="flex items-center gap-2">
                <div
                  className="
                    w-9
                    h-9
                    rounded-xl
                    bg-blue-50
                    text-blue-600
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Navigation className="w-4 h-4" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    בחירת אפליקציית ניווט
                  </h3>

                  <p className="text-[10px] text-slate-400 mt-0.5">
                    לאן תרצה לנווט?
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNavigationAddress(null)
                }
                className="
                  w-8
                  h-8
                  rounded-lg
                  flex
                  items-center
                  justify-center
                  text-slate-400
                  hover:bg-slate-100
                  hover:text-slate-600
                "
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="
                mx-5
                mt-4
                p-3
                bg-slate-50
                rounded-xl
                border
                border-slate-100
                text-xs
                text-slate-600
              "
            >
              <div className="flex items-start gap-2">
                <MapPin
                  className="
                    w-4
                    h-4
                    text-slate-400
                    shrink-0
                    mt-0.5
                  "
                />

                <span>
                  {navigationAddress}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-2">
              <button
                type="button"
                onClick={() =>
                  openNavigation('waze')
                }
                className="
                  w-full
                  flex
                  items-center
                  justify-between
                  px-4
                  py-3
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  hover:bg-slate-50
                  hover:border-blue-200
                  transition
                  text-right
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      w-9
                      h-9
                      rounded-lg
                      bg-blue-50
                      text-blue-600
                      flex
                      items-center
                      justify-center
                      font-bold
                      text-xs
                    "
                  >
                    W
                  </div>

                  <span className="text-sm font-medium text-slate-700">
                    Waze
                  </span>
                </div>

                <Navigation className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() =>
                  openNavigation('google')
                }
                className="
                  w-full
                  flex
                  items-center
                  justify-between
                  px-4
                  py-3
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  hover:bg-slate-50
                  hover:border-blue-200
                  transition
                  text-right
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      w-9
                      h-9
                      rounded-lg
                      bg-slate-100
                      text-slate-700
                      flex
                      items-center
                      justify-center
                      font-bold
                      text-xs
                    "
                  >
                    G
                  </div>

                  <span className="text-sm font-medium text-slate-700">
                    Google Maps
                  </span>
                </div>

                <Navigation className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() =>
                  openNavigation('apple')
                }
                className="
                  w-full
                  flex
                  items-center
                  justify-between
                  px-4
                  py-3
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  hover:bg-slate-50
                  hover:border-blue-200
                  transition
                  text-right
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      w-9
                      h-9
                      rounded-lg
                      bg-slate-100
                      text-slate-700
                      flex
                      items-center
                      justify-center
                      font-bold
                      text-xs
                    "
                  >
                    
                  </div>

                  <span className="text-sm font-medium text-slate-700">
                    Apple Maps
                  </span>
                </div>

                <Navigation className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div
              className="
                px-5
                pb-5
                text-[10px]
                text-slate-400
                text-center
              "
            >
              האפליקציה תיפתח בחלון חדש
            </div>
          </div>
        </div>
      )}
    </>
  );
}
