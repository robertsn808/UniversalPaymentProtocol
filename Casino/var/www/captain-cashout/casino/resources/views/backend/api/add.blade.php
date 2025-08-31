@extends('backend.layouts.app')

@section('page-title', trans('app.add_api'))
@section('page-heading', trans('app.add_api'))

@section('content')

<section class="content-header">
@include('backend.partials.messages')
</section>

    <section class="content">
   <form action="{{ route('backend.api.store') }}" method="POST" enctype="multipart/form-data" id="api-form">
		@csrf
      <div class="box box-default">
        <div class="box-header with-border">
          <h3 class="box-title">@lang('app.add_api')</h3>
        </div>

        <div class="box-body">
          <div class="row">

            @include('backend.api.partials.base', ['edit' => false, 'profile' => false])

          </div>
        </div>

        <div class="box-footer">
            <button type="submit" class="btn btn-primary">
                @lang('app.add_api')
            </button>
        </div>
      </div>
    </form>
    </section>

@stop

@section('scripts')
    <script>
        $(function() {
            $('#generateKey').click(function(){
                $.ajax({
                    url: "{{ route('backend.api.generate') }}",
                    dataType: 'json',
                    success: function(data){
                        $('#keygen').val( data.key );
                    }
                });
            });
        });
    </script>
@stop
