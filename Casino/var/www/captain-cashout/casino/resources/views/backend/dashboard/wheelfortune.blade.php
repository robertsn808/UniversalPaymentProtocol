@extends('backend.layouts.app')

@section('page-title', trans('app.wheelfortune'))
@section('page-heading', trans('app.wheelfortune'))

@section('content')

    <section class="content-header">
        @include('backend.partials.messages')
    </section>

    <section class="content">
             <form action="{{ route('backend.wheelfortune.update') }}" method="POST">
            @csrf
        <div class="box box-default">
            <div class="box-header with-border">
                <h3 class="box-title">{{ trans('app.wheelfortune') }}</h3>
                <div class="pull-right box-tools">
                    @permission('wheelfortune.manage')
                    @if( auth()->user()->shop )
                        @if( auth()->user()->shop->wheelfortune_active )
                            <a href="{{ route('backend.wheelfortune.status', 'disable') }}" class="btn btn-danger btn-sm">@lang('app.disable')</a>
                        @else
                            <a href="{{ route('backend.wheelfortune.status', 'activate') }}" class="btn btn-success btn-sm">@lang('app.active')</a>
                        @endif
                    @endif
                    @endpermission
                </div>
            </div>

            @php
                $wh1 = array_combine(\VanguardLTE\WheelFortune::$values['wh1'], \VanguardLTE\WheelFortune::$values['wh1']);
                $wh2 = array_combine(\VanguardLTE\WheelFortune::$values['wh2'], \VanguardLTE\WheelFortune::$values['wh2']);
            @endphp

            <div class="box-body">
                <div class="row">
                    @for($i=1; $i<=7; $i++)
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>@lang('app.wh')1 {{ $i }}</label>
                                 <select name="wh1_{{ $i }}" class="form-control">
                                        @foreach(\VanguardLTE\WheelFortune::$values['wh1'] as $value)
                                            <option value="{{ $value }}" {{ $wheelfortune->{'wh1_' . $i} == $value ? 'selected' : '' }}>{{ $value }}</option>
                                        @endforeach
                                    </select>
                            </div>
                        </div>
                    @endfor
                </div>

                <hr>

                <div class="row">
                    @for($i=1; $i<=8; $i++)
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>@lang('app.wh')2 {{ $i }}</label>
                               <select name="wh2_{{ $i }}" class="form-control">
                                        @foreach(\VanguardLTE\WheelFortune::$values['wh1'] as $value)
                                            <option value="{{ $value }}" {{ $wheelfortune->{'wh2_' . $i} == $value ? 'selected' : '' }}>{{ $value }}</option>
                                        @endforeach
                                    </select>
                            </div>
                        </div>
                    @endfor
                </div>

                <hr>

                <div class="row">
                    @for($i=1; $i<=16; $i++)
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>@lang('app.wh')3 {{ $i }}</label>
                                 <select name="wh3_{{ $i }}" class="form-control">
                                        @foreach(\VanguardLTE\WheelFortune::$values['wh2'] as $value)
                                            <option value="{{ $value }}" {{ $wheelfortune->{'wh3_' . $i} == $value ? 'selected' : '' }}>{{ $value }}</option>
                                        @endforeach
                                    </select>
                            </div>
                        </div>
                    @endfor
                </div>

                <hr>

                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>@lang('app.wager')</label>
                             <select name="wager" class="form-control">
                                    @foreach(\VanguardLTE\WheelFortune::$values['wager'] as $value)
                                        <option value="{{ $value }}" {{ $wheelfortune->wager == $value ? 'selected' : '' }}>{{ $value }}</option>
                                    @endforeach
                                </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="status">@lang('app.status')</label>
                             <select name="status" id="status" class="form-control">
                                    <option value="0" {{ $wheelfortune->status == 0 ? 'selected' : '' }}>@lang('app.disabled')</option>
                                    <option value="1" {{ $wheelfortune->status == 1 ? 'selected' : '' }}>@lang('app.active')</option>
                                </select>
                        </div>
                    </div>
                </div>

            </div>

            <div class="box-footer">
                <button type="submit" class="btn btn-primary">
                    @lang('app.edit_wheelfortune')
                </button>
            </div>
        </div>
        </form>
    </section>

@stop
